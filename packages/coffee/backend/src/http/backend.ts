import * as Arr from "effect/Array";
import { AuthAdaptersLive } from "@effect-coffee-shop/coffee-auth/adapters";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { SqlClient } from "effect/sql";
import { HttpRouter, HttpServerResponse } from "effect/http";
import type { SqlBatchCommit } from "@yielded/auth-persistence/Adapter";
import { makeCoffeeAuth, type AuthServerConfig } from "@effect-coffee-shop/coffee-auth/server";
import { makeCoffeeOAuth, CoffeeOAuth } from "@effect-coffee-shop/coffee-auth/oauth";
import { McpActor } from "@effect-coffee-shop/coffee-mcp/actor";
/**
 * Builds a Coffee web handler for Web Request/Response HTTP runtimes.
 *
 * @module
 */
import { CurrentActor, anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";

export type CoffeeWebHandlerInput = Parameters<typeof createCoffeeWebHandler>;

export type CoffeeRoutesLayer = CoffeeWebHandlerInput[0];
export type CoffeeAppLayer = CoffeeWebHandlerInput[1];

/** A request owns the complete route graph and releases database/MCP resources before returning. */
export const handleCoffeeRequest = <E>(input: {
  readonly request: Request;
  readonly auth: Option.Option<AuthServerConfig>;
  readonly database: Layer.Layer<SqlClient.SqlClient | SqlBatchCommit, E>;
  readonly appLayer: CoffeeAppLayer;
  readonly httpRoutes: typeof CoffeeHttpApiLive;
  readonly mcpRoutes: typeof CoffeeMcpHttpLive;
}) => {
  const path = new URL(input.request.url).pathname;
  if (
    Option.isNone(input.auth) &&
    (path === "/api/auth" ||
      path.startsWith("/api/auth/") ||
      path === "/mcp" ||
      path.startsWith("/oauth/") ||
      path.startsWith("/.well-known/"))
  ) {
    return Effect.succeed(new Response("Authentication is unavailable.", { status: 503 }));
  }
  const api = Layer.unwrap(
    Effect.map(HttpRouter.HttpRouter, (router) =>
      input.httpRoutes.pipe(
        Layer.provide(Layer.succeed(HttpRouter.HttpRouter, router.prefixed("/api"))),
      ),
    ),
  );
  const routes = Option.match(input.auth, {
    onNone: () =>
      Layer.mergeAll(
        api.pipe(
          Layer.provide(
            HttpRouter.middleware<{ provides: CurrentActor }>()((effect) =>
              Effect.provideService(effect, CurrentActor, anonymousActor),
            ).layer,
          ),
        ),
        HttpRouter.add(
          "*",
          "/api/auth/*",
          HttpServerResponse.text("Configure APP_ORIGIN, AUTH_SECRET and MCP_SIGNING_KEY.", {
            status: 503,
          }),
        ),
        HttpRouter.add("*", "/mcp", HttpServerResponse.empty({ status: 503 })),
      ),
    onSome: (config) => {
      const auth = makeCoffeeAuth(config, input.database, AuthAdaptersLive);
      const browser = Layer.merge(
        auth.routes,
        api.pipe(Layer.provide(auth.middleware.layer), Layer.provide(auth.auth)),
      );
      if (Arr.isReadonlyArrayEmpty(config.mcpClients))
        return Layer.merge(
          browser,
          HttpRouter.add(
            "*",
            "/mcp",
            HttpServerResponse.text("Configure MCP_CLIENTS to enable remote MCP.", { status: 503 }),
          ),
        );
      const oauth = makeCoffeeOAuth(config, auth, input.database);
      const mcpActor = Layer.effect(
        McpActor,
        Effect.map(SqlClient.SqlClient, (sql) => ({
          current: oauth.actor().pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        })),
      );
      return Layer.mergeAll(
        browser,
        input
          .mcpRoutes(oauth.allowedOrigins)
          .pipe(
            Layer.provide(mcpActor),
            Layer.provide(CoffeeOAuth.middleware(["coffee:access"]).layer),
          ),
        CoffeeOAuth.routes,
      ).pipe(
        Layer.provide(oauth.cors),
        Layer.provide(oauth.authorization),
        Layer.provide(input.database),
      );
    },
  });
  const acquire = Effect.sync(() => createCoffeeWebHandler(routes, input.appLayer));
  return Effect.acquireUseRelease(
    acquire,
    (server) => Effect.promise(() => server.handler(input.request)),
    (server) => Effect.promise(() => server.dispose()),
  );
};
