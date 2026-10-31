import { encodeCBOR, type CBORType } from "@levischuck/tiny-cbor";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Digest, KeyFormat, SecureRandom, Signature } from "effect/crypto";
import * as Base64Url from "effect/encoding/Base64Url";

/** The P-256 public point, from the key's JWK. */
const Coordinates = Schema.Struct({
  x: Schema.Uint8ArrayFromBase64Url,
  y: Schema.Uint8ArrayFromBase64Url,
});

/** The WebAuthn clientDataJSON wire shape. */
const ClientData = Schema.fromJsonString(
  Schema.Struct({
    type: Schema.String,
    challenge: Schema.String,
    origin: Schema.String,
    isCrossOrigin: Schema.Boolean,
  }).pipe(Schema.encodeKeys({ isCrossOrigin: "crossOrigin" })),
);
const encodeClientData = Schema.encodeSync(ClientData);

const CryptoLive = Layer.mergeAll(Signature.layerWebCrypto, Digest.layerWebCrypto).pipe(
  Layer.provideMerge(SecureRandom.layerWebCrypto),
);

const concat = (parts: ReadonlyArray<Uint8Array>) =>
  Uint8Array.from(Arr.flatMap(parts, (part) => Arr.fromIterable(part)));

const bigEndianUint32 = (value: number) => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

/** One DER INTEGER: minimal big-endian bytes, with a 0x00 pad when the sign bit is set. */
const derInteger = (bytes: Uint8Array): Uint8Array => {
  const minimal = Arr.dropWhile(
    Arr.fromIterable(bytes),
    (byte, index) => byte === 0 && index < bytes.length - 1,
  );
  const positive = (minimal[0] ?? 0) >= 0x80 ? [0, ...minimal] : minimal;
  return Uint8Array.from([0x02, positive.length, ...positive]);
};

/** WebAuthn ES256 signatures are DER `SEQUENCE { r, s }`; WebCrypto signs raw `r‖s`. */
const derSignature = (raw: Uint8Array) => {
  const body = concat([derInteger(raw.subarray(0, 32)), derInteger(raw.subarray(32))]);
  return concat([Uint8Array.from([0x30, body.length]), body]);
};

/** A software ES256 authenticator: production code still verifies every signature. */
export const makeTestPasskey = Effect.fn("CoffeeAuth.makeTestPasskey")(function* (
  origin: string,
  userHandle: string,
) {
  const signature = yield* Signature.Signature;
  const digest = yield* Digest.Digest;
  const random = yield* SecureRandom.SecureRandom;
  const keys = yield* signature.generateKeyPair(Signature.ecdsaP256);
  const coordinates = yield* Schema.decodeUnknownEffect(Coordinates)(
    yield* KeyFormat.encode(KeyFormat.jwk, keys.publicKey),
  );
  const credentialId = yield* random.randomBytes(32);
  const coseKey = encodeCBOR(
    // oxlint-disable-next-line effect/avoid-native-object-helpers -- tiny-cbor's CBORType models CBOR maps only as native Map.
    new Map<number, CBORType>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, coordinates.x],
      [-3, coordinates.y],
    ]),
  );
  const rpHash = yield* digest.digest(
    Digest.sha256,
    new TextEncoder().encode(new URL(origin).hostname),
  );
  const clientData = (type: string, challenge: string) =>
    new TextEncoder().encode(encodeClientData({ type, challenge, origin, isCrossOrigin: false }));
  const id = Base64Url.encode(credentialId);

  return {
    credentialId: id,
    publicKey: Base64Url.encode(coseKey),
    register: (challenge: string) => {
      // UP + UV + AT, zero counter, zero AAGUID, 32-byte credential ID, COSE key.
      const authData = concat([
        rpHash,
        Uint8Array.from([69, 0, 0, 0, 0]),
        new Uint8Array(16),
        Uint8Array.from([0, 32]),
        credentialId,
        coseKey,
      ]);
      const attestation = encodeCBOR(
        // oxlint-disable-next-line effect/avoid-native-object-helpers -- tiny-cbor's CBORType models CBOR maps only as native Map.
        new Map<string, CBORType>([
          ["fmt", "none"],
          // oxlint-disable-next-line effect/avoid-native-object-helpers -- tiny-cbor's CBORType models CBOR maps only as native Map.
          ["attStmt", new Map()],
          ["authData", authData],
        ]),
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: Base64Url.encode(clientData("webauthn.create", challenge)),
          attestationObject: Base64Url.encode(attestation),
          transports: ["internal"],
        },
        clientExtensionResults: {},
        authenticatorAttachment: "platform",
      };
    },
    authenticate: Effect.fn("CoffeeAuth.TestPasskey.authenticate")(function* (
      challenge: string,
      counter: number,
    ) {
      const authenticatorData = concat([rpHash, Uint8Array.from([5]), bigEndianUint32(counter)]);
      const data = clientData("webauthn.get", challenge);
      const signed = yield* signature.sign(
        keys.privateKey,
        concat([authenticatorData, yield* digest.digest(Digest.sha256, data)]),
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        response: {
          clientDataJSON: Base64Url.encode(data),
          authenticatorData: Base64Url.encode(authenticatorData),
          signature: Base64Url.encode(derSignature(signed)),
          userHandle,
        },
        clientExtensionResults: {},
      };
    }),
  };
}, Effect.provide(CryptoLive));
