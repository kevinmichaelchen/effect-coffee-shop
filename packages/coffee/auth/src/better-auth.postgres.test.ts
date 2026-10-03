/* oxlint-disable effect/avoid-native-object-helpers -- Actor resolution requires the runtime's native ReadonlySet. */
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import {
  authSchema,
  DrizzlePgliteSchemaLive,
  makePgliteCoffeeDbLayer,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";
import { anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { createCoffeeAuth, resolveCoffeeActor } from "./better-auth/shared.ts";
import { decodeBetterAuthPasskeyMaterial } from "./yielded/better-auth.ts";
import { makeTestPasskey } from "./testing/passkey.ts";
import {
  AuthenticationOptions,
  RegistrationOptions,
  RegisteredPasskey,
  makeAuthClient,
} from "./testing/auth-client.ts";

describe("Postgres credential and session compatibility", () => {
  it("preserves credentials and actors using the committed Postgres tables", async () => {
    const pg = new PGlite();
    const migrations = ManagedRuntime.make(
      DrizzlePgliteSchemaLive.pipe(Layer.provide(makePgliteCoffeeDbLayer(pg))),
    );
    await migrations.context();

    // Better Auth's adapter is Promise-based and addresses models by these names.
    // This checks the persisted Postgres contract without pretending that an
    // Effect Drizzle client is an asynchronous Better Auth query client.
    const database = drizzleAdapter(drizzle({ client: pg }), {
      provider: "pg",
      schema: {
        user: authSchema.usersTable,
        session: authSchema.sessionsTable,
        account: authSchema.accountsTable,
        passkey: authSchema.passkeysTable,
        verification: authSchema.verificationTable,
      },
    });
    const origin = "http://localhost";
    const secret = "coffee-auth-test-secret-at-least-32-characters";
    const auth = createCoffeeAuth({ database, request: new Request(origin), secret });
    const client = makeAuthClient(auth, origin);
    const resolve = () =>
      resolveCoffeeActor({
        database,
        secret,
        request: client.request(),
        staffUserIds: new Set(),
      });

    const check = async () => {
      const begun = await client.send(
        "/passkey/generate-register-options?context=%7B%22displayName%22%3A%22Alice%22%7D",
      );
      expect(begun.status).toBe(200);
      const options: RegistrationOptions = Schema.decodeUnknownSync(RegistrationOptions)(
        await begun.json(),
      );
      const authenticator = makeTestPasskey(origin, options.user.id);
      const registered = await client.send("/passkey/verify-registration", {
        response: authenticator.register(options.challenge),
        createSession: true,
      });
      expect(registered.status).toBe(200);
      const passkey: RegisteredPasskey = Schema.decodeUnknownSync(RegisteredPasskey)(
        await registered.json(),
      );
      expect(await resolve()).toEqual({
        kind: "customer",
        userId: passkey.userId,
        displayName: "Alice",
      });
      const rows = await pg.query("SELECT * FROM passkey WHERE id = $1", [passkey.id]);
      // oxlint-disable-next-line effect/effect-run-in-body -- Native Vitest owns this Promise boundary.
      const material = await Effect.runPromise(decodeBetterAuthPasskeyMaterial(rows.rows[0]));
      expect(material.publicKey).toBe(authenticator.publicKey);
      expect(material.subjectId).toBe(passkey.userId);

      const savedRequest = client.request();
      expect((await client.send("/sign-out", {})).status).toBe(200);
      expect(
        await resolveCoffeeActor({
          database,
          secret,
          request: savedRequest,
          staffUserIds: new Set(),
        }),
      ).toEqual(anonymousActor);
      const begunLogin = await client.send("/passkey/generate-authenticate-options");
      const login: AuthenticationOptions = Schema.decodeUnknownSync(AuthenticationOptions)(
        await begunLogin.json(),
      );
      expect(
        (
          await client.send("/passkey/verify-authentication", {
            response: authenticator.authenticate(login.challenge),
          })
        ).status,
      ).toBe(200);
      expect(await resolve()).toHaveProperty("userId", passkey.userId);
      await pg.query('UPDATE session SET "expiresAt" = to_timestamp(0) WHERE "userId" = $1', [
        passkey.userId,
      ]);
      expect(await resolve()).toEqual(anonymousActor);
    };
    await check().finally(async () => {
      await migrations.dispose();
      await pg.close();
    });
    // PGlite's WASM startup competes with other workspaces in the affected suite.
  }, 30_000);
});
