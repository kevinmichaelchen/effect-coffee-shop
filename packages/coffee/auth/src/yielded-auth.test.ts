import { Miniflare } from "miniflare";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { Passkey } from "@yielded/auth";
import { assert, describe, expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { SecureRandom } from "effect/crypto";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/http";
import { migrateCloudflareD1 } from "./testing/migrate.ts";
import { d1AuthDatabase } from "./database.ts";
import { makeAuthClient } from "./testing/auth-client.ts";
import { makeTestPasskey } from "./testing/passkey.ts";
import { AuthAdaptersLive } from "./adapters.ts";
import { makeCoffeeAuth, type AuthServerConfig } from "./server.ts";

type AuthServer = Effect.Success<ReturnType<typeof authServer>>;

/** The auth routes plus an actor probe, served as a scoped Fetch handler. */
const authServer = (config: AuthServerConfig, database: ReturnType<typeof d1AuthDatabase>) => {
  const auth = makeCoffeeAuth(config, database, AuthAdaptersLive);
  const routes = Layer.merge(
    auth.routes,
    HttpRouter.add(
      "GET",
      "/api/auth/actor",
      Effect.flatMap(auth.actor(), HttpServerResponse.schemaJson(AppActor)),
    ).pipe(auth.http.middleware, Layer.provide(auth.auth)),
  ).pipe(Layer.provide(HttpServer.layerServices));
  return Effect.map(
    Effect.acquireRelease(
      Effect.sync(() => HttpRouter.toWebHandler(routes, { disableLogger: true })),
      (server) => Effect.promise(async () => server.dispose()),
    ),
    (server) => ({
      handler: async (request: Request) => server.handler(request, Context.empty()),
    }),
  );
};

const encodeJson = Schema.encodeSync(Schema.fromJsonString(Schema.Json));
const respond = (auth: AuthServer, request: Request) =>
  Effect.promise(async () => auth.handler(request));
const decodeBody =
  <S extends Schema.Top>(schema: S) =>
  (response: Response) =>
    Effect.promise(async () => response.text()).pipe(
      Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(schema))),
      Effect.orDie,
    );
const expectOk = (response: Response) =>
  Effect.map(
    Effect.promise(async () => response.clone().text()),
    (body) => {
      assert.equal(response.status, 200, body);
    },
  );
const resolveActor = (auth: AuthServer, request: Request) =>
  respond(
    auth,
    new Request(new URL("/api/auth/actor", request.url), { headers: request.headers }),
  ).pipe(Effect.flatMap(decodeBody(AppActor)));

const origin = "http://localhost";
const config = {
  origin,
  oauthSecret: Redacted.make("A".repeat(43)),
  mcpClients: [],
  secret: Redacted.make("coffee-auth-test-secret-at-least-32-characters"),
  staffUserIds: HashSet.empty<string>(),
};
const flow = SecureRandom.SecureRandom.use((random) =>
  Effect.map(
    Effect.all([random.uuidV4(), random.uuidV4()], { concurrency: 1 }),
    ([flowId, commandId]) => ({
      flowId,
      commandId,
      profileId: "default",
    }),
  ),
).pipe(Effect.provide(SecureRandom.layerWebCrypto));
const registrationResult = Schema.TaggedStruct("Success", {
  value: Passkey.PasskeyRegistrationStarted,
});
const authenticationResult = Schema.TaggedStruct("Success", {
  value: Passkey.PasskeyAuthenticationStarted,
});

const d1Fixture = Effect.fnUntraced(function* () {
  const proxy = yield* Effect.acquireRelease(
    Effect.sync(
      () =>
        new Miniflare({
          modules: true,
          script: "export default { fetch() { return new Response(); } }",
          d1Databases: ["DB"],
        }),
    ),
    (proxy) => Effect.promise(async () => proxy.dispose()),
  );
  const db = yield* Effect.promise(async () => proxy.getD1Database("DB"));
  yield* migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer));
  return {
    database: d1AuthDatabase(db),
    expire: Effect.promise(async () =>
      db.prepare("update coffee_auth_sessions set expires_at = 0").run(),
    ),
  };
});

describe.each([{ name: "D1", fixture: d1Fixture }])(
  "Yielded $name authentication",
  ({ fixture }) => {
    it.live(
      "verifies passkeys, binds ceremonies, enforces staff authority, revokes and expires sessions",
      () =>
        Effect.gen(function* () {
          const data = yield* fixture();
          const auth = yield* authServer(config, data.database);
          const client = makeAuthClient(auth, origin);
          const send = (path: string, body: Schema.Json) =>
            Effect.promise(async () => client.send(path, body));

          const begun = yield* send("/register", {
            ...(yield* flow),
            registration: { displayName: " Alice ", role: "staff", userId: "chosen-staff-id" },
          });
          yield* expectOk(begun);
          const registration = (yield* decodeBody(registrationResult)(begun)).value;
          const authenticator = yield* makeTestPasskey(origin, registration.options.user.id);
          const enrollment = {
            flowId: registration.flowId,
            response: encodeJson(authenticator.register(registration.options.challenge)),
          };
          const outsider = makeAuthClient(auth, origin);
          expect(
            (yield* Effect.promise(async () => outsider.send("/completeRegistration", enrollment)))
              .status,
          ).not.toBe(200);
          yield* expectOk(yield* send("/completeRegistration", enrollment));
          expect(yield* resolveActor(auth, client.request())).toEqual({ kind: "anonymous" });
          expect((yield* send("/completeRegistration", enrollment)).status).not.toBe(200);

          const signIn = Effect.fnUntraced(function* (counter: number) {
            const login = yield* send("/signIn", yield* flow);
            yield* expectOk(login);
            const assertion = (yield* decodeBody(authenticationResult)(login)).value;
            yield* expectOk(
              yield* send("/completeSignIn", {
                flowId: assertion.flowId,
                response: encodeJson(
                  yield* authenticator.authenticate(assertion.options.challenge, counter),
                ),
              }),
            );
          });
          yield* signIn(1);
          const actor = yield* resolveActor(auth, client.request());
          expect(actor).toMatchObject({ kind: "customer", displayName: "Alice" });
          assert(actor.kind === "customer");
          expect(actor.userId).not.toBe("chosen-staff-id");

          // Staff authority is deployment configuration, never a session claim.
          const staffAuth = yield* authServer(
            { ...config, staffUserIds: HashSet.make(actor.userId) },
            data.database,
          );
          expect(yield* resolveActor(staffAuth, client.request())).toMatchObject({
            kind: "staff",
            userId: actor.userId,
          });

          const oldRequest = client.request();
          expect((yield* send("/signOut", {})).status).toBe(200);
          expect(yield* resolveActor(auth, oldRequest)).toEqual({ kind: "anonymous" });
          yield* signIn(2);
          yield* data.expire;
          expect(yield* resolveActor(auth, client.request())).toEqual({ kind: "anonymous" });

          const forgedChallenge = (yield* decodeBody(authenticationResult)(
            yield* send("/signIn", yield* flow),
          )).value;
          const assertion = yield* authenticator.authenticate(forgedChallenge.options.challenge, 3);
          const impostor = yield* makeTestPasskey(origin, registration.options.user.id);
          const invalidSignature = (yield* impostor.authenticate(
            forgedChallenge.options.challenge,
            3,
          )).response.signature;
          const forged = yield* send("/completeSignIn", {
            flowId: forgedChallenge.flowId,
            response: encodeJson({
              ...assertion,
              response: { ...assertion.response, signature: invalidSignature },
            }),
          });
          expect(forged.status).toBe(400);
          expect(yield* resolveActor(auth, client.request())).toEqual({ kind: "anonymous" });

          const register = Effect.fnUntraced(function* (headers: Record<string, string>) {
            return yield* respond(
              auth,
              new Request(`${origin}/api/auth/register`, {
                method: "POST",
                headers: { "content-type": "application/json", ...headers },
                body: encodeJson({
                  payload: { ...(yield* flow), registration: { displayName: "Mallory" } },
                }),
              }),
            );
          });
          expect((yield* register({ origin })).status).toBe(403);
          expect(
            (yield* register({ origin: "https://attacker.example", "x-effect-auth-csrf": "1" }))
              .status,
          ).toBe(403);
        }),
      60_000,
    );
  },
);
