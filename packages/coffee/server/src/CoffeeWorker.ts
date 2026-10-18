/**
 * The Coffee Shop backend Worker. It hosts the domain model on Durable
 * Objects (every order, cart and view key is its own object, declared while
 * the model's Layer is built) and serves:
 *
 * - `/api/customer` and `/api/staff`: the domain's `CustomerApi` and
 *   `StaffApi`, behind the auth session;
 * - `/api/auth/*`, `/oauth/*`, `/.well-known/*`: Yielded Auth and MCP OAuth;
 * - `/api/health`, `/api/menu`, `/api/me`: REST;
 * - `/mcp`: remote MCP tools over the same model.
 *
 * Swap `DomainCloudflare.DurableObjects` for `Domain.InMemory` and nothing
 * else changes, which is how the tests run it.
 *
 * @module
 */
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { type AuthDeployment, readAuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { annotateHttpStatus, withHttpWideEvent } from "@effect-coffee-shop/http-routing/logging";
import * as Cloudflare from "alchemy/Cloudflare";
import type { HttpEffect } from "alchemy/Http";
import * as DomainCloudflare from "alchemy/Domain/Cloudflare";
import * as Effect from "effect/Effect";
import * as HttpServerError from "effect/http/HttpServerError";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { WideEventLogger } from "effect-wide-event";
import { AuthDatabase } from "./AuthDatabase.ts";
import { authSecret } from "./AuthSecret.ts";
import { coffeeHttp, domainApi, isOrStartsWith, needsAuth, rejectBearer } from "./CoffeeHttp.ts";
import { SessionLive } from "./Session.ts";

/** The model on Durable Objects, the Apis' middleware, and the adapters' service over the model. */
const CoffeeLive = Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
  Layer.provideMerge(CoffeeShop.layer(CoffeeShopHandlers)),
  Layer.provide(DomainCloudflare.DurableObjects),
  Layer.provideMerge(
    Layer.mergeAll(
      Cloudflare.D1.QueryDatabaseBinding,
      Cloudflare.SecretsStore.ReadSecretBinding,
      WideEventLogger.Json,
    ),
  ),
);

const routeKindOf = (path: string) =>
  isOrStartsWith(path, "/api/customer") || isOrStartsWith(path, "/api/staff")
    ? "domain"
    : path.startsWith("/api/auth") || path.startsWith("/oauth") || path.startsWith("/.well-known")
      ? "auth"
      : path.startsWith("/mcp")
        ? "mcp"
        : path.startsWith("/api")
          ? "api"
          : "unmatched";

interface CoffeeServices {
  readonly deployment: AuthDeployment;
  readonly db: Cloudflare.D1.QueryDatabaseClient;
  readonly readAuthSecret: Effect.Success<ReturnType<typeof Cloudflare.SecretsStore.ReadSecret>>;
  readonly customerApi: HttpEffect;
  readonly staffApi: HttpEffect;
  readonly app: CoffeeOrderApp["Service"];
}

/** Route one request: the domain Apis, auth, REST and MCP. */
const handleRequest = Effect.fn("CoffeeWorker.fetch")(function* (services: CoffeeServices) {
  const request = yield* HttpServerRequest;
  const path = new URL(request.url, "http://localhost").pathname;
  // A missing or unreadable secret disables auth: auth paths answer 503, the rest anonymously.
  const secret = yield* services.readAuthSecret.pipe(Effect.option);
  const input = {
    auth: Option.map(secret, (secret) => ({ ...services.deployment, secret })),
    database: d1AuthDatabase(yield* services.db.raw),
    app: services.app,
  };
  const response = yield* Option.isNone(input.auth) && needsAuth(path)
    ? Effect.succeed(HttpServerResponse.text("Authentication is unavailable.", { status: 503 }))
    : isOrStartsWith(path, "/api/customer")
      ? rejectBearer(domainApi(input, services.customerApi))
      : isOrStartsWith(path, "/api/staff")
        ? rejectBearer(domainApi(input, services.staffApi))
        : path.startsWith("/api")
          ? rejectBearer(coffeeHttp(input))
          : coffeeHttp(input);
  yield* annotateHttpStatus({ routeKind: routeKindOf(path), status: response.status });
  return response;
});

/** One wide event per request; failures are logged on it, then answered as a safe response. */
const serve = (services: CoffeeServices) =>
  Effect.flatMap(HttpServerRequest, (request) =>
    handleRequest(services).pipe(
      Effect.catchCause((cause) =>
        Effect.map(HttpServerError.causeResponse(cause), ([response]) => response),
      ),
      withHttpWideEvent({ method: request.method }),
    ),
  );

export default class CoffeeWorker extends Cloudflare.Worker<CoffeeWorker>()(
  "CoffeeWorker",
  {
    main: import.meta.url,
    compatibility: { flags: ["nodejs_compat"] },
    observability: {
      enabled: true,
      logs: { enabled: true, invocationLogs: true, persist: true },
      traces: { enabled: true, persist: true },
    },
  },
  Effect.gen(function* () {
    const services: CoffeeServices = {
      deployment: yield* readAuthDeployment(),
      db: yield* Cloudflare.D1.QueryDatabase(yield* AuthDatabase),
      readAuthSecret: yield* Cloudflare.SecretsStore.ReadSecret(yield* authSecret()),
      customerApi: (yield* CustomerApi).fetch,
      staffApi: (yield* StaffApi).fetch,
      app: yield* CoffeeOrderApp,
    };
    return { fetch: serve(services) };
  }).pipe(Effect.provide(CoffeeLive)),
) {}
