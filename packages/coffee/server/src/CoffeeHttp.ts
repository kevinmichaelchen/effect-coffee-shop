/**
 * The Worker's HTTP surface around the domain Apis: the auth routes, the REST
 * endpoints (health, menu, me), remote MCP (hand-written tools, and tools
 * generated from the domain Apis) with its OAuth server, and the domain Apis
 * behind the auth session.
 *
 * The surface is auth-dependent, so it is built as a *generation*: one
 * `AUTH_SECRET`'s route graph and the one auth it shares, built once and
 * reused by every request that presents that secret (see `Generation.ts`).
 * Without a readable secret there is no auth, and a request's anonymous
 * surface is built for it alone.
 *
 * @module
 */
import * as Arr from "effect/Array";
import { AuthAdaptersLive } from "@effect-coffee-shop/coffee-auth/adapters";
import type { AuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import { CoffeeOAuth, coffeeAccess, makeCoffeeOAuth } from "@effect-coffee-shop/coffee-auth/oauth";
import {
  type AuthDatabase,
  type AuthServerConfig,
  type CoffeeAuthLayers,
  crossOriginMutation,
  makeCoffeeAuth,
} from "@effect-coffee-shop/coffee-auth/server";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CurrentActor, anonymousActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { McpActor } from "@effect-coffee-shop/coffee-mcp/actor";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import type * as DomainAi from "@alchemy.run/domain/Ai";
import type { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import type { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import type { HttpEffect } from "alchemy/Http";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequestModule from "effect/http/HttpServerRequest";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import type * as Scope from "effect/Scope";
import { SqlClient } from "effect/sql";
import { actorHeader, actorHeaderValue } from "@effect-coffee-shop/coffee-application/ActorHeader";
import { asActor, withActorValue } from "./Session.ts";

/** What the MCP tools generated from the domain Apis need: the hosted model and the Apis' middleware. */
export type DomainToolServices = DomainAi.Services<typeof CustomerApi | typeof StaffApi>;

/** The deployment's services: the same for every request, and for every secret. */
export interface CoffeeDeployment {
  /** Auth settings without the request-binding secret, which a generation adds. */
  readonly auth: AuthDeployment;
  readonly database: AuthDatabase;
  readonly app: CoffeeOrderApp["Service"];
  /** The Worker's hosted model and Api middleware, for the generated MCP tools. */
  readonly domain: Context.Context<DomainToolServices>;
}

/** The auth one generation shares: one `makeCoffeeAuth` result, built once. */
export interface CoffeeAuth {
  /** The deployment's auth settings, completed by the generation's secret. */
  readonly config: AuthServerConfig;
  /** Auth's routes, middleware and actor checks, all reading the one built auth. */
  readonly layers: CoffeeAuthLayers;
  /** `layers.auth`, built: a request provides this instead of building auth again. */
  readonly services: Context.Context<Layer.Success<CoffeeAuthLayers["auth"]>>;
}

/**
 * One secret's whole surface. Built once per secret; without a readable secret
 * `auth` is `none` and the surface answers as an anonymous caller.
 */
export interface CoffeeGeneration {
  readonly auth: Option.Option<CoffeeAuth>;
  /** The router: auth routes, REST, MCP and the domain Apis. */
  readonly http: HttpEffect;
}

const restApi = Layer.unwrap(
  Effect.map(HttpRouter.HttpRouter, (router) =>
    CoffeeHttpApiLive.pipe(
      Layer.provide(Layer.succeed(HttpRouter.HttpRouter, router.prefixed("/api"))),
    ),
  ),
);

/** `/mcp` answers 503 when the deployment configures no MCP clients. */
const mcpUnconfigured = HttpRouter.add(
  "*",
  "/mcp",
  HttpServerResponse.text("Configure MCP_CLIENTS to enable remote MCP.", { status: 503 }),
);

/**
 * The whole surface for one secret: auth's routes, the REST API and the domain
 * Apis behind auth's middleware, and MCP with its OAuth server. `auth` is
 * already built, so nothing here builds it again.
 */
const authenticatedRoutes = (input: CoffeeDeployment, auth: CoffeeAuth) => {
  const built = Layer.succeedContext(auth.services);
  const browser = Layer.merge(
    auth.layers.routes.pipe(Layer.provide(built)),
    restApi.pipe(Layer.provide(auth.layers.middleware.layer), Layer.provide(built)),
  );
  if (Arr.isReadonlyArrayEmpty(auth.config.mcpClients)) {
    return Layer.merge(browser, mcpUnconfigured);
  }
  const oauth = makeCoffeeOAuth(auth.config, auth.layers, input.database);
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
      Layer.provide(CoffeeOAuth.middleware([coffeeAccess]).layer),
    ),
    CoffeeOAuth.routes,
  ).pipe(
    Layer.provide(oauth.cors),
    Layer.provide(oauth.authorization),
    Layer.provide(input.database),
  );
};

/**
 * Build one secret's generation: one auth, its services built, and the whole
 * route graph over them. Run in the generation's own scope, once per secret.
 */
export const coffeeGeneration = (input: CoffeeDeployment, secret: Redacted.Redacted) =>
  Effect.gen(function* () {
    const config: AuthServerConfig = { ...input.auth, secret };
    const made = makeCoffeeAuth(config, input.database, AuthAdaptersLive);
    // A secret that cannot build auth is a defect, as it always was: auth off
    // is a failed *read*, not a failed build.
    const services = yield* Layer.build(made.auth).pipe(
      Effect.orDie,
      // The build's memo map is not a service to hand on: providing it would
      // tie every later build to this one's already-built layers.
      Effect.map(Context.omit(Layer.CurrentMemoMap)),
    );
    const auth: CoffeeAuth = {
      config,
      // Every consumer of the layers shares the auth built above.
      layers: { ...made, auth: Layer.succeedContext(services) },
      services,
    };
    const http = yield* HttpRouter.toHttpEffect(
      authenticatedRoutes(input, auth).pipe(
        Layer.provide(Layer.succeed(CoffeeOrderApp, input.app)),
        Layer.provide(Layer.succeedContext(input.domain)),
        Layer.provide(HttpServer.layerServices),
      ),
    ).pipe(
      // Built once per generation: a graph that cannot build is a defect, and
      // a route failure its own middleware does not answer is the request's 500.
      Effect.orDie,
      Effect.map(Effect.orDie),
    );
    return { auth: Option.some(auth), http } satisfies CoffeeGeneration;
  });

/**
 * The surface for a request whose secret could not be read: the REST API over
 * the domain Apis, every caller anonymous. Built for that request alone, so a
 * failed secret read is never remembered.
 */
export const anonymousGeneration = (
  input: CoffeeDeployment,
): Effect.Effect<CoffeeGeneration, never, Scope.Scope> =>
  Effect.map(
    HttpRouter.toHttpEffect(
      restApi.pipe(
        Layer.provide(
          HttpRouter.middleware<{ provides: CurrentActor }>()((effect) =>
            Effect.provideService(effect, CurrentActor, anonymousActor),
          ).layer,
        ),
        Layer.provide(Layer.succeed(CoffeeOrderApp, input.app)),
        Layer.provide(Layer.succeedContext(input.domain)),
        Layer.provide(HttpServer.layerServices),
      ),
    ).pipe(Effect.orDie, Effect.map(Effect.orDie)),
    (http) => ({ auth: Option.none<CoffeeAuth>(), http }),
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
 * Whether the request carries a signed-in session, for a surface that accepts
 * nothing else. Without auth (local runs, or a secret that could not be read)
 * there is no session to check, and the surface answers as if the caller were
 * signed in.
 */
export const signedIn = (generation: CoffeeGeneration, request: HttpServerRequest) =>
  Option.match(generation.auth, {
    onNone: () => Effect.succeed(true),
    onSome: (auth) =>
      auth.layers.http
        .withRequest(
          Effect.map(auth.layers.actor(), (actor) =>
            HttpServerResponse.empty({
              status: Option.isSome(actorHeaderValue(actor)) ? 204 : 401,
            }),
          ),
        )
        .pipe(
          Effect.map((response) => response.status === 204),
          Effect.provideService(HttpServerRequest, sessionProbe(request)),
          Effect.provide(auth.services),
          Effect.orElseSucceed(() => false),
        ),
  });

/**
 * A domain Api behind the auth session: the caller's actor is resolved from
 * their session cookie and attached for the Api's `Session` middleware, and
 * any session cookies auth refreshes are passed on. Mutations must come from
 * the app's own origin.
 */
export const domainApi = (generation: CoffeeGeneration, api: HttpEffect) =>
  Option.match(generation.auth, {
    onNone: () => api.pipe(asActor(anonymousActor)),
    onSome: (auth) => {
      const appOrigin = new URL(auth.config.origin).origin;
      const resolveActor = (request: HttpServerRequest) =>
        auth.layers.http
          .withRequest(
            Effect.map(auth.layers.actor(), (actor) =>
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
        Effect.provide(auth.services),
      );
      return Effect.flatMap(HttpServerRequest, (request) =>
        crossOriginMutation(appOrigin)(request)
          ? Effect.succeed(HttpServerResponse.empty({ status: 403 }))
          : authenticated,
      );
    },
  });
