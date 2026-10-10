/* oxlint-disable effect/effect-run-in-body, effect/avoid-native-object-helpers -- Vitest owns the native Promise boundary and fixtures use the actor port's ReadonlySet. */
import { Miniflare } from "miniflare";
import { PGlite } from "@electric-sql/pglite";
import { PgliteClient } from "@effect/sql-pglite";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { Passkey } from "@yielded/auth";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { assert, describe, expect, it } from "vitest";
import { migrateCloudflareD1 } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import {
  DrizzlePgliteSchemaLive,
  DrizzlePostgresSchemaReady,
  makePgliteCoffeeDbLayer,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
import { d1AuthDatabase, transactionalAuthDatabase } from "./database.ts";
import { makeCoffeeAuthServer } from "./testing/server.ts";
import { makeAuthClient } from "./testing/auth-client.ts";
import { makeTestPasskey } from "./testing/passkey.ts";

const resolveActor = async (auth: ReturnType<typeof makeCoffeeAuthServer>, request: Request) => {
  const response = await auth.handler(
    new Request(new URL("/api/auth/actor", request.url), { headers: request.headers }),
  );
  return Schema.decodeUnknownSync(AppActor)(await response.json());
};
const origin = "http://localhost";
const config = {
  origin,
  oauthSecret: Redacted.make("A".repeat(43)),
  mcpClients: [],
  secret: Redacted.make("coffee-auth-test-secret-at-least-32-characters"),
  staffUserIds: new Set<string>(),
};
const flow = () => ({
  flowId: crypto.randomUUID(),
  commandId: crypto.randomUUID(),
  profileId: "default",
});
const registrationResult = Schema.TaggedStruct("Success", {
  value: Passkey.PasskeyRegistrationStarted,
});
const authenticationResult = Schema.TaggedStruct("Success", {
  value: Passkey.PasskeyAuthenticationStarted,
});

const d1Fixture = async () => {
  const proxy = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    d1Databases: ["DB"],
  });
  const db = await proxy.getD1Database("DB");
  await Effect.runPromise(migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer)));
  return {
    database: d1AuthDatabase(db),
    expire: () => db.prepare("update coffee_auth_sessions set expires_at = 0").run(),
    dispose: () => proxy.dispose(),
  };
};

const postgresFixture = async () => {
  const pg = new PGlite();
  await Effect.runPromise(
    DrizzlePostgresSchemaReady.pipe(
      Effect.provide(DrizzlePgliteSchemaLive.pipe(Layer.provide(makePgliteCoffeeDbLayer(pg)))),
    ),
  );
  return {
    database: transactionalAuthDatabase(PgliteClient.layer({ liveClient: pg })),
    expire: () => pg.query("update coffee_auth_sessions set expires_at = 0"),
    dispose: () => pg.close(),
  };
};

describe.each([
  { name: "D1", fixture: d1Fixture },
  { name: "PostgreSQL", fixture: postgresFixture },
])("Yielded $name authentication", ({ fixture }) => {
  it("verifies passkeys, binds ceremonies, enforces staff authority, revokes and expires sessions", async () => {
    const data = await fixture();
    const auth = makeCoffeeAuthServer<unknown>(config, data.database);
    const staffIds = new Set<string>();
    const staffAuth = makeCoffeeAuthServer<unknown>(
      { ...config, staffUserIds: staffIds },
      data.database,
    );
    const check = async () => {
      const client = makeAuthClient(auth, origin);
      const begun = await client.send("/register", {
        ...flow(),
        registration: { displayName: " Alice ", role: "staff", userId: "chosen-staff-id" },
      });
      assert.equal(begun.status, 200, await begun.clone().text());
      const registration = Schema.decodeUnknownSync(registrationResult)(await begun.json()).value;
      const authenticator = makeTestPasskey(origin, registration.options.user.id);
      const enrollment = {
        flowId: registration.flowId,
        response: Schema.encodeSync(Schema.fromJsonString(Schema.Json))(
          authenticator.register(registration.options.challenge),
        ),
      };
      const outsider = makeAuthClient(auth, origin);
      expect((await outsider.send("/completeRegistration", enrollment)).status).not.toBe(200);
      const registered = await client.send("/completeRegistration", enrollment);
      assert.equal(registered.status, 200, await registered.clone().text());
      expect(await resolveActor(auth, client.request())).toEqual({
        kind: "anonymous",
      });
      expect((await client.send("/completeRegistration", enrollment)).status).not.toBe(200);
      const signIn = async (counter: number) => {
        const login = await client.send("/signIn", flow());
        assert.equal(login.status, 200, await login.clone().text());
        const assertion = Schema.decodeUnknownSync(authenticationResult)(await login.json()).value;
        const signedIn = await client.send("/completeSignIn", {
          flowId: assertion.flowId,
          response: Schema.encodeSync(Schema.fromJsonString(Schema.Json))(
            authenticator.authenticate(assertion.options.challenge, counter),
          ),
        });
        assert.equal(signedIn.status, 200, await signedIn.clone().text());
      };
      await signIn(1);
      const actor = await resolveActor(auth, client.request());
      expect(actor).toMatchObject({ kind: "customer", displayName: "Alice" });
      assert(actor.kind === "customer");
      expect(actor.userId).not.toBe("chosen-staff-id");
      staffIds.add(actor.userId);
      expect(await resolveActor(staffAuth, client.request())).toMatchObject({
        kind: "staff",
        userId: actor.userId,
      });
      const oldRequest = client.request();
      expect((await client.send("/signOut", {})).status).toBe(200);
      expect(await resolveActor(auth, oldRequest)).toEqual({ kind: "anonymous" });
      await signIn(2);
      await data.expire();
      expect(await resolveActor(auth, client.request())).toEqual({
        kind: "anonymous",
      });
      const forgedLogin = await client.send("/signIn", flow());
      const forgedChallenge = Schema.decodeUnknownSync(authenticationResult)(
        await forgedLogin.json(),
      ).value;
      const assertion = authenticator.authenticate(forgedChallenge.options.challenge, 3);
      const invalidSignature = makeTestPasskey(origin, registration.options.user.id).authenticate(
        forgedChallenge.options.challenge,
        3,
      ).response.signature;
      const forged = await client.send("/completeSignIn", {
        flowId: forgedChallenge.flowId,
        response: Schema.encodeSync(Schema.fromJsonString(Schema.Json))({
          ...assertion,
          response: { ...assertion.response, signature: invalidSignature },
        }),
      });
      expect(forged.status).toBe(400);
      expect(await resolveActor(auth, client.request())).toEqual({
        kind: "anonymous",
      });
      const missingCsrf = await auth.handler(
        new Request(`${origin}/api/auth/register`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: Schema.encodeSync(Schema.fromJsonString(Schema.Json))({
            payload: { ...flow(), registration: { displayName: "Mallory" } },
          }),
        }),
      );
      expect(missingCsrf.status).toBe(403);
      const rejected = await auth.handler(
        new Request(`${origin}/api/auth/register`, {
          method: "POST",
          headers: {
            origin: "https://attacker.example",
            "content-type": "application/json",
            "x-effect-auth-csrf": "1",
          },
          body: Schema.encodeSync(Schema.fromJsonString(Schema.Json))({
            payload: { ...flow(), registration: { displayName: "Mallory" } },
          }),
        }),
      );
      expect(rejected.status).toBe(403);
    };
    await check().finally(async () => {
      await staffAuth.dispose();
      await auth.dispose();
      await data.dispose();
    });
  }, 60_000);
});
