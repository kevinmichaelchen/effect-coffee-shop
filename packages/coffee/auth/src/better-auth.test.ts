/* oxlint-disable effect/avoid-native-object-helpers -- Cookie parsing requires a native Map; runtime actor ports require native Sets. */
import type { D1Database } from "@cloudflare/workers-types";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import { describe, expect, it } from "vitest";
import { anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { migrateCloudflareD1 } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import {
  createCloudflareAuth,
  resolveCloudflareActor,
} from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import {
  createProvisionalUser,
  createRegisteredUser,
  getDisplayName,
} from "@effect-coffee-shop/coffee-auth/better-auth/users";
import { decodeBetterAuthPasskeyMaterial } from "./yielded/better-auth.ts";
import { makeTestPasskey } from "./testing/passkey.ts";

import {
  AuthenticationOptions,
  RegistrationOptions,
  RegisteredPasskey,
  makeAuthClient,
} from "./testing/auth-client.ts";

async function withTestDatabase<A>(effect: (db: D1Database) => Promise<A>): Promise<A> {
  const proxy = await getPlatformProxy<{ readonly DB: D1Database }>({
    bindings: [D1.local({ binding: "DB" })],
    name: "coffee-better-auth-test",
  });

  // oxlint-disable-next-line effect/effect-run-in-body -- Native Promise/callback boundary owns running this Effect; application effects stay composed.
  await Effect.runPromise(
    migrateCloudflareD1(proxy.env.DB).pipe(Effect.provide(NodeServices.layer)),
  );

  return effect(proxy.env.DB).finally(() => proxy.dispose());
}

describe("passkey registration helpers", () => {
  it("creates provisional users from the registration context display name", () => {
    const provisional = createProvisionalUser(getDisplayName('{"displayName":"Alice Example"}'));

    expect(provisional.displayName).toBe("Alice Example");
    expect(provisional.id.startsWith("passkey-signup-")).toBe(true);
    expect(provisional.name).toBe("Alice Example");
  });

  it("persists passkey-first users from the verify-registration context", () => {
    const created = createRegisteredUser({
      context: '{"displayName":"Alice Example"}',
      userId: "passkey-signup-user-123",
    });

    expect(created).toEqual({
      email: "passkey-signup-user-123@users.coffee.invalid",
      id: "passkey-signup-user-123",
      name: "Alice Example",
    });
  });

  it("rejects blank display names", () => {
    expect(() => getDisplayName('{"displayName":"   "}')).toThrowError(
      "displayName must not be blank",
    );
  });
});

describe("cloudflare better-auth wiring", () => {
  it("preserves passkey signup, sign-in, session actors and revocation through the Yielded boundary", async () => {
    await withTestDatabase(async (db) => {
      const origin = "http://localhost";
      const secret = "coffee-auth-test-secret-at-least-32-characters";
      // Older bindings need only these methods. Optional D1 APIs may be absent.
      const authDb = {
        prepare: db.prepare.bind(db),
        batch: db.batch.bind(db),
        exec: db.exec.bind(db),
      };
      const auth = createCloudflareAuth({ db: authDb, request: new Request(origin), secret });
      const client = makeAuthClient(auth, origin);
      const context = encodeURIComponent('{"displayName":"  Alice Example  "}');
      const begun = await client.send(`/passkey/generate-register-options?context=${context}`);
      expect(begun.status).toBe(200);
      const options: RegistrationOptions = Schema.decodeUnknownSync(RegistrationOptions)(
        await begun.json(),
      );
      const authenticator = makeTestPasskey(origin, options.user.id);
      const registration = authenticator.register(options.challenge);
      const registered = await client.send("/passkey/verify-registration", {
        response: registration,
        name: "My passkey",
        createSession: true,
      });
      expect(registered.status).toBe(200);
      const passkey: RegisteredPasskey = Schema.decodeUnknownSync(RegisteredPasskey)(
        await registered.json(),
      );
      const resolve = (staffUserIds: ReadonlySet<string> = new Set()) =>
        resolveCloudflareActor({
          db: authDb,
          secret,
          request: client.request(),
          staffUserIds,
        });
      expect(await resolve()).toEqual({
        kind: "customer",
        userId: passkey.userId,
        displayName: "Alice Example",
      });
      expect(await resolve(new Set([passkey.userId]))).toHaveProperty("kind", "staff");

      const stored = await db
        .prepare("SELECT * FROM passkey WHERE id = ?")
        .bind(passkey.id)
        .first();
      // oxlint-disable-next-line effect/effect-run-in-body -- Native Vitest harness owns this Promise boundary.
      const material = await Effect.runPromise(decodeBetterAuthPasskeyMaterial(stored));
      expect(material.protocolCredentialId).toBe(authenticator.credentialId);
      expect(material.publicKey).toBe(authenticator.publicKey);
      expect(material.subjectId).toBe(passkey.userId);
      expect(stored).not.toHaveProperty("userHandle");

      const replay = await client.send("/passkey/verify-registration", {
        response: registration,
        createSession: true,
      });
      expect(replay.ok).toBe(false);

      const oldRequest = client.request();
      expect((await client.send("/sign-out", {})).status).toBe(200);
      expect(await resolve()).toEqual(anonymousActor);
      expect(
        await resolveCloudflareActor({ db, secret, request: oldRequest, staffUserIds: new Set() }),
      ).toEqual(anonymousActor);

      const badLogin = await client.send("/passkey/generate-authenticate-options");
      const badChallenge = Schema.decodeUnknownSync(AuthenticationOptions)(
        await badLogin.json(),
      ).challenge;
      const forgedAssertion = authenticator.authenticate(badChallenge);
      expect(
        (
          await client.send("/passkey/verify-authentication", {
            response: {
              ...forgedAssertion,
              response: { ...forgedAssertion.response, signature: "AA" },
            },
          })
        ).ok,
      ).toBe(false);
      expect(await resolve()).toEqual(anonymousActor);

      const login = await client.send("/passkey/generate-authenticate-options");
      const challenge = Schema.decodeUnknownSync(AuthenticationOptions)(
        await login.json(),
      ).challenge;
      const assertion = authenticator.authenticate(challenge);
      const signedIn = await client.send("/passkey/verify-authentication", { response: assertion });
      expect(signedIn.status).toBe(200);
      expect(await resolve()).toEqual({
        kind: "customer",
        userId: passkey.userId,
        displayName: "Alice Example",
      });
      expect(
        (await client.send("/passkey/verify-authentication", { response: assertion })).ok,
      ).toBe(false);

      const forged = new Request(`${origin}/api/me`, {
        headers: { cookie: "better-auth.session_token=forged.invalid" },
      });
      expect(
        await resolveCloudflareActor({ db, secret, request: forged, staffUserIds: new Set() }),
      ).toEqual(anonymousActor);
      await db
        .prepare('UPDATE session SET "expiresAt" = 0 WHERE "userId" = ?')
        .bind(passkey.userId)
        .run();
      expect(await resolve()).toEqual(anonymousActor);
    });
  });

  it("rejects a different origin without creating a user, credential or session", async () => {
    await withTestDatabase(async (db) => {
      const origin = "http://localhost";
      const secret = "coffee-auth-test-secret-at-least-32-characters";
      const auth = createCloudflareAuth({ db, request: new Request(origin), secret });
      const client = makeAuthClient(auth, origin);
      const begun = await client.send(
        "/passkey/generate-register-options?context=%7B%22displayName%22%3A%22Alice%22%7D",
      );
      const options: RegistrationOptions = Schema.decodeUnknownSync(RegistrationOptions)(
        await begun.json(),
      );
      const wrongOrigin = makeTestPasskey("http://evil.localhost", options.user.id);
      expect(
        (
          await client.send("/passkey/verify-registration", {
            response: wrongOrigin.register(options.challenge),
            createSession: true,
          })
        ).ok,
      ).toBe(false);
      expect(
        await resolveCloudflareActor({
          db,
          secret,
          request: client.request(),
          staffUserIds: new Set(),
        }),
      ).toEqual(anonymousActor);
      const counts = await db
        .prepare(
          'SELECT (SELECT count(*) FROM "user") users, (SELECT count(*) FROM passkey) passkeys, (SELECT count(*) FROM session) sessions',
        )
        .first();
      expect(counts).toEqual({ users: 0, passkeys: 0, sessions: 0 });
    });
  });

  it("requires a nonblank secret when constructing auth", async () => {
    await withTestDatabase(async (db) => {
      expect(() =>
        createCloudflareAuth({
          db,
          request: new Request("http://example.com/api/auth/session"),
          secret: "   ",
        }),
      ).toThrowError("Expected a value with a length of at least 1");
    });
  });

  it("resolves anonymous actors when auth is not configured", async () => {
    await withTestDatabase(async (db) => {
      const actor = await resolveCloudflareActor({
        db,
        request: new Request("http://example.com/api/me"),
        secret: undefined,
        staffUserIds: new Set(["staff-user"]),
      });

      expect(actor).toEqual(anonymousActor);
    });
  });
});
