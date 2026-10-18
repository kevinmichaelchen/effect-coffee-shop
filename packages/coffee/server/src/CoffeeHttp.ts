/**
 * The Worker's HTTP surface around the domain Apis: the auth routes, the REST
 * endpoints (health, menu, me), remote MCP with its OAuth server, and the
 * domain Apis behind the auth session. Each request builds and releases its
 * own route graph, so nothing request-scoped is shared across requests.
 *
 * @module
 */
import * as Arr from "effect/Array";
import { AuthAdaptersLive } from "@effect-coffee-shop/coffee-auth/adapters";
import { CoffeeOAuth, makeCoffeeOAuth } from "@effect-coffee-shop/coffee-auth/oauth";
import { type AuthServerConfig, makeCoffeeAuth } from "@effect-coffee-shop/coffee-auth/server";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CurrentActor, anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { McpActor } from "@effect-coffee-shop/coffee-mcp/actor";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import type { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import type { HttpEffect } from "alchemy/Http";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequestModule from "effect/http/HttpServerRequest";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { SqlClient } from "effect/sql";
import { actorHeader, actorHeaderValue, asActor, withActorValue } from "./Session.ts";

export interface CoffeeHttpInput {
  /** Auth configuration, when the deployment has its secrets. */
  readonly auth: Option.Option<AuthServerConfig>;
  readonly database: ReturnType<typeof d1AuthDatabase>;
  readonly app: CoffeeOrderApp["Service"];
}

/** The path is `prefix` itself or below it (Effect RPC clients post to `prefix/`). */
export const isOrStartsWith = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Paths that need auth configured: without it they answer 503. */
export const needsAuth = (path: string) =>
  isOrStartsWith(path, "/api/auth") ||
  isOrStartsWith(path, "/mcp") ||
  path.startsWith("/oauth/") ||
  path.startsWith("/.well-known/");

const hasBearerAuthorization = (request: HttpServerRequest) =>
  Option.fromNullishOr(request.headers.authorization).pipe(
    Option.exists((value) => value.trimStart().toLowerCase().startsWith("bearer ")),
  );

/** App routes authenticate with session cookies; agents use MCP with OAuth instead. */
export const rejectBearer = <E, R>(
  effect: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>,
) =>
  Effect.flatMap(HttpServerRequest, (request) =>
    hasBearerAuthorization(request)
      ? HttpServerResponse.json(
          {
            error:
              "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
          },
          { status: 400 },
        ).pipe(Effect.orDie)
      : effect,
  );

const restApi = Layer.unwrap(
  Effect.map(HttpRouter.HttpRouter, (router) =>
    CoffeeHttpApiLive.pipe(
      Layer.provide(Layer.succeed(HttpRouter.HttpRouter, router.prefixed("/api"))),
    ),
  ),
);

const routesFor = (input: CoffeeHttpInput) =>
  Option.match(input.auth, {
    onNone: () =>
      restApi.pipe(
        Layer.provide(
          HttpRouter.middleware<{ provides: CurrentActor }>()((effect) =>
            Effect.provideService(effect, CurrentActor, anonymousActor),
          ).layer,
        ),
      ),
    onSome: (config) => {
      const auth = makeCoffeeAuth(config, input.database, AuthAdaptersLive);
      const browser = Layer.merge(
        auth.routes,
        restApi.pipe(Layer.provide(auth.middleware.layer), Layer.provide(auth.auth)),
      );
      if (Arr.isReadonlyArrayEmpty(config.mcpClients)) {
        return Layer.merge(
          browser,
          HttpRouter.add(
            "*",
            "/mcp",
            HttpServerResponse.text("Configure MCP_CLIENTS to enable remote MCP.", { status: 503 }),
          ),
        );
      }
      const oauth = makeCoffeeOAuth(config, auth, input.database);
      const mcpActor = Layer.effect(
        McpActor,
        Effect.map(SqlClient.SqlClient, (sql) => ({
          current: oauth.actor().pipe(Effect.provideService(SqlClient.SqlClient, sql)),
        })),
      );
      return Layer.mergeAll(
        browser,
        CoffeeMcpHttpLive(oauth.allowedOrigins).pipe(
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

/** Auth, REST and MCP routes for one request. */
export const coffeeHttp = (input: CoffeeHttpInput) =>
  HttpRouter.toHttpEffect(
    routesFor(input).pipe(
      Layer.provide(Layer.succeed(CoffeeOrderApp, input.app)),
      Layer.provide(HttpServer.layerServices),
    ),
  ).pipe(
    Effect.orDie,
    Effect.flatMap((http) => http),
  );

/**
 * The caller's session, resolved from a body-less copy of the request:
 * auth reads the request through the Fetch API, which would consume the
 * body the Api still has to read.
 */
const sessionProbe = (request: HttpServerRequest) =>
  HttpServerRequestModule.fromWeb(
    new Request(new URL(request.url, request.headers.origin ?? "http://localhost"), {
      // The session lives in cookies; the origin is what auth checks them against.
      headers: Arr.flatMap(["cookie", "origin"], (name) =>
        Arr.fromOption(
          Option.map(Headers.get(request.headers, name), (value): [string, string] => [
            name,
            value,
          ]),
        ),
      ),
    }),
  );

/**
 * A domain Api behind the auth session: the caller's actor is resolved from
 * their session cookie and attached for the Api's `Session` middleware, and
 * any session cookies auth refreshes are passed on. Mutations must come from
 * the app's own origin.
 */
export const domainApi = (input: CoffeeHttpInput, api: HttpEffect) =>
  Option.match(input.auth, {
    onNone: () => api.pipe(asActor(anonymousActor)),
    onSome: (config) => {
      const auth = makeCoffeeAuth(config, input.database, AuthAdaptersLive);
      const resolveActor = (request: HttpServerRequest) =>
        auth.http
          .withRequest(
            Effect.map(auth.actor(), (actor) =>
              Option.match(actorHeaderValue(actor), {
                onNone: () => HttpServerResponse.empty(),
                onSome: (value) =>
                  HttpServerResponse.setHeader(HttpServerResponse.empty(), actorHeader, value),
              }),
            ),
          )
          .pipe(Effect.provideService(HttpServerRequest, sessionProbe(request)));
      const authenticated = Effect.flatMap(HttpServerRequest, (request) =>
        Effect.flatMap(resolveActor(request), (probe) =>
          api.pipe(
            Effect.provideService(
              HttpServerRequest,
              request.modify({
                headers: withActorValue(request.headers, Headers.get(probe.headers, actorHeader)),
              }),
            ),
            Effect.map((response) => HttpServerResponse.mergeCookies(response, probe.cookies)),
          ),
        ),
      ).pipe(
        Effect.catchTag("OperationHttpError", () =>
          Effect.succeed(HttpServerResponse.empty({ status: 403 })),
        ),
        Effect.provide(auth.auth),
      );
      return Effect.flatMap(HttpServerRequest, (request) =>
        request.method !== "GET" && request.headers.origin !== new URL(config.origin).origin
          ? Effect.succeed(HttpServerResponse.empty({ status: 403 }))
          : authenticated,
      );
    },
  });
