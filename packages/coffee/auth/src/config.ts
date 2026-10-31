import * as OAuthServer from "@yielded/auth/OAuthServer";
import * as Config from "effect/Config";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import * as Base64Url from "effect/encoding/Base64Url";

const PublicOrigin = Schema.URL.check(
  Schema.makeFilter(
    (url) =>
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === "" &&
      url.username === "" &&
      url.password === "" &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))),
    {
      identifier: "PublicOrigin",
      title: "Public application origin",
      description:
        "An HTTPS origin, or HTTP on a literal loopback host, without credentials, path, query, or fragment.",
    },
  ),
);
const SigningKey = Schema.Redacted(
  Schema.String.check(
    Schema.makeFilter(
      (value) =>
        Result.match(Base64Url.decode(value), {
          onFailure: () => false,
          onSuccess: (bytes) => bytes.length >= 32,
        }),
      {
        identifier: "OAuthSigningKey",
        title: "OAuth signing key",
        description: "At least 32 random bytes encoded as base64url.",
      },
    ),
  ),
);
const Clients = Schema.fromJsonString(Schema.Array(OAuthServer.Client));

const StaffUserIds = Schema.String.pipe(
  Schema.decodeTo(
    Schema.HashSet(Schema.String),
    SchemaTransformation.transform({
      decode: (csv): HashSet.HashSet<string> =>
        HashSet.fromIterable(Arr.filter(Arr.map(Str.split(csv, ","), Str.trim), Str.isNonEmpty)),
      encode: (ids: HashSet.HashSet<string>) => Arr.join(Arr.fromIterable(ids), ","),
    }),
  ),
);

/** Decode deployment configuration once; request URLs never establish trust. */
const readOrigins = Effect.fn("CoffeeAuth.readOrigins")(function* () {
  const origin = yield* Config.schema(PublicOrigin, "APP_ORIGIN");
  const oauthSecret = yield* Config.schema(SigningKey, "MCP_SIGNING_KEY");
  const mcpClients = yield* Config.schema(Clients, "MCP_CLIENTS").pipe(Config.withDefault([]));
  return { origin: origin.origin, oauthSecret, mcpClients };
});

/**
 * Everything auth needs from the deployment except its request-binding
 * secret, which is read live from Secrets Store on each request.
 */
export const readAuthDeployment = Effect.fn("CoffeeAuth.readAuthDeployment")(function* () {
  const origins = yield* readOrigins();
  const staffUserIds = yield* Config.schema(StaffUserIds, "COFFEE_STAFF_USER_IDS").pipe(
    Config.withDefault(HashSet.empty<string>()),
  );
  return { ...origins, staffUserIds };
});
export type AuthDeployment = Effect.Success<ReturnType<typeof readAuthDeployment>>;

export const readAuthConfig = (
  secret: Option.Option<Redacted.Redacted>,
  staffUserIds: HashSet.HashSet<string>,
) =>
  Option.match(secret, {
    onNone: () => Effect.succeedNone,
    onSome: (secret) =>
      readOrigins().pipe(
        Effect.map((origins) => Option.some({ ...origins, secret, staffUserIds })),
      ),
  });
