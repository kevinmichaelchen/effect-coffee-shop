/* oxlint-disable effect/avoid-native-object-helpers -- The CBOR encoder requires native Maps. */
// oxlint-disable-next-line effect/avoid-node-imports -- Node crypto belongs to this software-authenticator test adapter.
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { encodeCBOR, type CBORType } from "@levischuck/tiny-cbor";
import * as Schema from "effect/Schema";

const Coordinates = Schema.Struct({ x: Schema.String, y: Schema.String });

/** A software ES256 authenticator: production code still verifies every signature. */
export function makeTestPasskey(origin: string, userHandle: string) {
  const rpId = new URL(origin).hostname;
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const coordinates = Schema.decodeUnknownSync(Coordinates)(publicKey.export({ format: "jwk" }));
  const credentialId = randomBytes(32);
  const coseKey = encodeCBOR(
    new Map<number, CBORType>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(coordinates.x, "base64url")],
      [-3, Buffer.from(coordinates.y, "base64url")],
    ]),
  );
  const rpHash = createHash("sha256").update(rpId).digest();
  const encodeClientData = Schema.encodeSync(
    Schema.fromJsonString(
      Schema.Struct({
        type: Schema.String,
        challenge: Schema.String,
        origin: Schema.String,
        // oxlint-disable-next-line effect/require-is-prefix-for-boolean-schema-field -- This is the WebAuthn clientDataJSON wire field.
        crossOrigin: Schema.Boolean,
      }),
    ),
  );
  const clientData = (type: string, challenge: string) =>
    Buffer.from(encodeClientData({ type, challenge, origin, crossOrigin: false }));

  return {
    credentialId: credentialId.toString("base64url"),
    publicKey: Buffer.from(coseKey).toString("base64url"),
    register: (challenge: string) => {
      // UP + UV + AT, zero counter, zero AAGUID, 32-byte credential ID, COSE key.
      const authData = Buffer.concat([
        rpHash,
        Buffer.from([69, 0, 0, 0, 0]),
        Buffer.alloc(16),
        Buffer.from([0, 32]),
        credentialId,
        coseKey,
      ]);
      const attestation = encodeCBOR(
        new Map<string, CBORType>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData],
        ]),
      );
      return {
        id: credentialId.toString("base64url"),
        rawId: credentialId.toString("base64url"),
        type: "public-key",
        response: {
          clientDataJSON: clientData("webauthn.create", challenge).toString("base64url"),
          attestationObject: Buffer.from(attestation).toString("base64url"),
          transports: ["internal"],
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
    authenticate: (challenge: string, counter = 1) => {
      const count = Buffer.alloc(4);
      count.writeUInt32BE(counter);
      const authenticatorData = Buffer.concat([rpHash, Buffer.from([5]), count]);
      const data = clientData("webauthn.get", challenge);
      const signature = sign(
        "sha256",
        Buffer.concat([authenticatorData, createHash("sha256").update(data).digest()]),
        privateKey,
      );
      return {
        id: credentialId.toString("base64url"),
        rawId: credentialId.toString("base64url"),
        type: "public-key",
        response: {
          clientDataJSON: data.toString("base64url"),
          authenticatorData: authenticatorData.toString("base64url"),
          signature: signature.toString("base64url"),
          userHandle,
        },
        clientExtensionResults: {},
      };
    },
  };
}
