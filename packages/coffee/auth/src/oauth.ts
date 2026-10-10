import * as Match from "effect/Match";
import { InternalAppError } from "@effect-coffee-shop/coffee-application/errors";
import * as OAuthServer from "@yielded/auth/OAuthServer";
import { OAuthServerPersistence } from "@yielded/auth-persistence";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { FetchHttpClient, HttpServerRequest, HttpRouter, HttpMiddleware } from "effect/http";
import { SqlClient } from "effect/sql";
import { AuthenticationRequiredError } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CoffeeAuth } from "./auth.ts";
import { actorFromIdentity } from "./yielded/identity.ts";
import type { AuthServerConfig, CoffeeAuthLayers } from "./server.ts";

export const CoffeeOAuth = OAuthServer.make("coffee", { scopes: ["coffee:access"] });

export const makeCoffeeOAuth = <E>(
  config: AuthServerConfig,
  auth: CoffeeAuthLayers<E>,
  database: Layer.Layer<SqlClient.SqlClient, E>,
) => {
  const identity = Layer.effect(
    CoffeeOAuth.Identity,
    Effect.gen(function* () {
      const service = yield* CoffeeAuth;
      const current = Effect.fn("CoffeeOAuth.currentIdentity")(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const cookie =
          request.cookies[
            new URL(config.origin).protocol === "https:"
              ? "__Host-coffee-session"
              : "coffee-session"
          ];
        if (cookie === undefined) return undefined;
        return yield* service.verifySession(Redacted.make(cookie)).pipe(
          Effect.map((session) => session.subjectId),
          Effect.catchTag("SessionInvalid", () => Effect.succeed(undefined)),
          Effect.mapError(() => OAuthServer.Unavailable.make({})),
        );
      });
      return { current: current() };
    }),
  ).pipe(Layer.provide(auth.auth));
  const authorization = CoffeeOAuth.layer({
    origin: config.origin,
    resource: `${config.origin}/mcp`,
    loginPath: "/login/mcp",
    keys: { activeKeyId: "v1", keys: [{ id: "v1", material: config.oauthSecret }] },
    clients: config.mcpClients,
  }).pipe(
    Layer.provide(identity),
    Layer.provide(OAuthServerPersistence.layer.pipe(Layer.provide(database))),
    Layer.provide(FetchHttpClient.layer),
    Layer.provide(auth.crypto),
  );
  const actor = Effect.fn("CoffeeOAuth.currentActor")(
    function* () {
      const access = yield* OAuthServer.CurrentAccess;
      if (access === undefined)
        return yield* new AuthenticationRequiredError({
          message: "MCP authorization is required.",
        });
      const sql = yield* SqlClient.SqlClient;
      const rows =
        yield* sql`select display_name as "displayName" from coffee_auth_subjects where id = ${access.subjectId} and active = ${sql.onDialectOrElse({ pg: () => true, orElse: () => 1 })}`;
      const [subject] = yield* Schema.decodeUnknownEffect(
        Schema.Array(Schema.Struct({ displayName: Schema.String })),
      )(rows);
      if (subject === undefined)
        return yield* new AuthenticationRequiredError({ message: "MCP account is unavailable." });
      return yield* actorFromIdentity(
        { subjectId: access.subjectId, displayName: subject.displayName },
        config.staffUserIds,
      );
    },
    Effect.mapError((error) =>
      Match.value(error).pipe(
        Match.tag("AuthenticationRequiredError", (error) => error),
        Match.orElse(
          () => new InternalAppError({ message: "Unable to resolve MCP account right now." }),
        ),
      ),
    ),
  );
  const allowedOrigins = config.mcpClients.flatMap((client) =>
    client.redirectUris
      .map((uri) => new URL(uri))
      .filter((url) => url.protocol === "http:" || url.protocol === "https:")
      .map((url) => url.origin),
  );
  const cors = HttpMiddleware.cors({
    allowedOrigins,
    allowedMethods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "MCP-Protocol-Version",
      "Mcp-Method",
      "Mcp-Name",
    ],
    exposedHeaders: ["WWW-Authenticate"],
  });
  const corsMiddleware = HttpRouter.middleware((effect) =>
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      return yield* new URL(request.url, config.origin).pathname === CoffeeOAuth.paths.authorize
        ? effect
        : cors(effect);
    }),
  );
  return { authorization, actor, allowedOrigins, cors: corsMiddleware.layer };
};
