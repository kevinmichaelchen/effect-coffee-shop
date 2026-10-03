import { Passkey, Schema as AuthSchema } from "@yielded/auth";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Base64Url } from "effect/encoding";
import { CoffeeAuthIdentity } from "./identity.ts";

const VerifiedBetterAuthUser = Schema.Struct({
  id: AuthSchema.SubjectId,
  name: Schema.Trim,
  email: Schema.String,
});

export class LegacyAuthInputError extends Schema.TaggedError<LegacyAuthInputError>()(
  "LegacyAuthInputError",
  { boundary: Schema.Literals(["session-user", "passkey-row"]) },
) {}

/** Call only with the user returned by Better Auth's verified getSession API. */
export const identityFromVerifiedBetterAuthUser = Effect.fn("CoffeeAuth.legacyIdentity")(
  // oxlint-disable-next-line effect/no-unknown-parameters -- This adapter decodes the external SDK response at its boundary.
  function* (input: unknown) {
    const user = yield* Schema.decodeUnknownEffect(VerifiedBetterAuthUser)(input).pipe(
      Effect.mapError(() => new LegacyAuthInputError({ boundary: "session-user" })),
    );

    return CoffeeAuthIdentity.make({
      subjectId: user.id,
      displayName: user.name || user.email,
    });
  },
);

const BetterAuthPasskeyRow = Schema.Struct({
  id: Passkey.PasskeyCredentialId,
  userId: AuthSchema.SubjectId,
  credentialID: Passkey.PasskeyProtocolCredentialId,
  // Better Auth persists standard base64; Yielded requires canonical base64url.
  publicKey: Schema.Uint8ArrayFromBase64,
  counter: Passkey.PasskeyCounter,
});

/** Reusable material only: this is deliberately not a complete Yielded credential. */
export const LegacyPasskeyMaterial = Schema.Struct({
  credentialId: Passkey.PasskeyCredentialId,
  subjectId: AuthSchema.SubjectId,
  protocolCredentialId: Passkey.PasskeyProtocolCredentialId,
  publicKey: Passkey.PasskeyPublicKey,
  counter: Passkey.PasskeyCounter,
});

export type LegacyPasskeyMaterial = typeof LegacyPasskeyMaterial.Type;

/** Read-only boundary for SQLite/D1 and Postgres rows. Never invent missing authority. */
export const decodeBetterAuthPasskeyMaterial = Effect.fn("CoffeeAuth.legacyPasskeyMaterial")(
  // oxlint-disable-next-line effect/no-unknown-parameters -- Persisted rows are decoded once at this adapter boundary.
  function* (input: unknown) {
    const row = yield* Schema.decodeUnknownEffect(BetterAuthPasskeyRow)(input);

    return yield* LegacyPasskeyMaterial.makeEffect({
      credentialId: row.id,
      subjectId: row.userId,
      protocolCredentialId: row.credentialID,
      publicKey: Base64Url.encode(row.publicKey),
      counter: row.counter,
    });
  },
  Effect.mapError(() => new LegacyAuthInputError({ boundary: "passkey-row" })),
);
