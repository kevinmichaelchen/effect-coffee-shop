/* oxlint-disable effect/avoid-native-object-helpers -- The actor port accepts a native ReadonlySet. */
import { assert, describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { actorFromIdentity } from "./identity.ts";
import {
  decodeBetterAuthPasskeyMaterial,
  identityFromVerifiedBetterAuthUser,
} from "./better-auth.ts";

describe("Yielded identity boundary", () => {
  it.effect("preserves opaque IDs and deployment-owned staff authority", () =>
    Effect.gen(function* () {
      const identity = yield* identityFromVerifiedBetterAuthUser({
        id: "passkey-signup-AbC-123",
        name: "  Alice  ",
        email: "alice@users.coffee.invalid",
        kind: "system",
        role: "staff",
      });
      expect(identity.subjectId).toBe("passkey-signup-AbC-123");
      expect(yield* actorFromIdentity(identity, new Set())).toEqual({
        userId: "passkey-signup-AbC-123",
        displayName: "Alice",
        kind: "customer",
      });
      expect(yield* actorFromIdentity(identity, new Set([identity.subjectId]))).toEqual({
        userId: "passkey-signup-AbC-123",
        displayName: "Alice",
        kind: "staff",
      });
      expect(
        yield* actorFromIdentity(identity, new Set(["passkey-signup-abc-123"])),
      ).toHaveProperty("kind", "customer");
    }),
  );

  it.effect("keeps the email fallback without normalizing the subject ID", () =>
    Effect.gen(function* () {
      const identity = yield* identityFromVerifiedBetterAuthUser({
        id: "  opaque-id  ",
        name: " \t ",
        email: "fallback@users.coffee.invalid",
      });
      expect(identity).toEqual({
        subjectId: "  opaque-id  ",
        displayName: "fallback@users.coffee.invalid",
      });
    }),
  );

  it.effect("rejects malformed verified-user input with a sanitized boundary error", () =>
    Effect.forEach(
      [null, {}, { id: "", name: "Alice", email: "private@example.com" }],
      (input) =>
        Effect.gen(function* () {
          const result = yield* identityFromVerifiedBetterAuthUser(input).pipe(Effect.result);
          assert(Result.isFailure(result));
          expect(result.failure._tag).toBe("LegacyAuthInputError");
          expect(result.failure.boundary).toBe("session-user");
          expect(result.failure.message).not.toContain("private@example.com");
        }),
      { concurrency: 1 },
    ),
  );
});

describe("legacy passkey material", () => {
  const row = {
    id: "credential-123",
    userId: "passkey-signup-AbC-123",
    credentialID: "AQID",
    publicKey: "+/8=",
    counter: 7,
  };

  it.effect(
    "converts standard base64 to Yielded's canonical base64url without inventing metadata",
    () =>
      Effect.gen(function* () {
        const material = yield* decodeBetterAuthPasskeyMaterial({ ...row, backedUp: 1 });
        expect(material).toEqual({
          credentialId: row.id,
          subjectId: row.userId,
          protocolCredentialId: "AQID",
          publicKey: "-_8",
          counter: 7,
        });
        expect(material).not.toHaveProperty("userHandle");
        expect(material).not.toHaveProperty("revision");
      }),
  );

  it.effect("rejects unusable material and counters instead of repairing them", () =>
    Effect.forEach(
      [
        { ...row, credentialID: "AQID=" },
        { ...row, publicKey: "%%%" },
        { ...row, publicKey: "" },
        { ...row, publicKey: Buffer.alloc(8193).toString("base64") },
        { ...row, counter: -1 },
        { ...row, counter: 4294967296 },
        { ...row, counter: 1.5 },
        { ...row, userId: "" },
      ],
      (input) =>
        Effect.gen(function* () {
          const result = yield* decodeBetterAuthPasskeyMaterial(input).pipe(Effect.result);
          assert(Result.isFailure(result));
          expect(result.failure.boundary).toBe("passkey-row");
        }),
      { concurrency: 1 },
    ),
  );
});
