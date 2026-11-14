/**
 * The Coffee Shop backend Worker, over whichever host the model runs on. Each
 * host has a thin Worker of its own (`CoffeeWorker` on Durable Objects,
 * `CoffeeWorkerRivet` on Rivet) that passes its model Layer here. It serves:
 *
 * - `/api/customer` and `/api/staff`: the domain's `CustomerApi` and
 *   `StaffApi` over Domain RPC, behind the auth session;
 * - `/api/rest/customer` and `/api/rest/staff`: the same Apis as REST, with
 *   an OpenAPI document at `/api/rest/openapi.json`, behind the auth session;
 * - `/api/auth/*`, `/oauth/*`, `/.well-known/*`: Yielded Auth and MCP OAuth;
 * - `/api/health`, `/api/menu`, `/api/me`: REST;
 * - `/mcp`: remote MCP tools over the same model, generated from the same Apis.
 *
 * The tests run the same model on `Domain.InMemory` instead.
 *
 * @module
 */
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { type AuthDeployment, readAuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/database";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { domainRestHttp } from "@effect-coffee-shop/coffee-http/domain-rest";
import { annotateHttpStatus, withHttpWideEvent } from "@effect-coffee-shop/http-routing/logging";
import * as Cloudflare from "@alchemy.run/cloudflare";
import type { HttpEffect } from "alchemy/Http";
import * as Effect from "effect/Effect";
import * as HttpServerError from "effect/http/HttpServerError";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import { WideEventLogger } from "effect-wide-event";
import { AuthDatabase } from "./AuthDatabase.ts";
import { authSecret } from "./AuthSecret.ts";
import type CoffeeShopLive from "./CoffeeShopLive.ts";
import {
  type CoffeeHttpInput,
  coffeeHttp,
  domainApi,
  type DomainToolServices,
  rejectBearer,
} from "./CoffeeHttp.ts";
import { needsAuth, rejectsBearer, routeKindOf, routeOf } from "./Routes.ts";
import { SessionLive } from "./Session.ts";

/** What a host Layer provides: the coffee shop model, wherever it runs. */
type HostedModel = Layer.Success<typeof CoffeeShopLive>;

/** The hosted model, the Apis' middleware, and the adapters' service over the model. */
const coffeeLive = <R>(model: Layer.Layer<HostedModel, never, R>) =>
  Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
    Layer.provideMerge(model),
    Layer.provideMerge(
      Layer.mergeAll(
        Cloudflare.D1.QueryDatabaseBinding,
        Cloudflare.SecretsStore.ReadSecretBinding,
        WideEventLogger.Json,
      ),
    ),
  );

interface CoffeeServices {
  readonly deployment: AuthDeployment;
  readonly db: Cloudflare.D1.QueryDatabaseClient;
  readonly readAuthSecret: Effect.Success<ReturnType<typeof Cloudflare.SecretsStore.ReadSecret>>;
  readonly customerApi: HttpEffect;
  readonly staffApi: HttpEffect;
  readonly domainRest: HttpEffect;
  readonly app: CoffeeOrderApp["Service"];
  readonly domain: CoffeeHttpInput["domain"];
}

const routeBackend = (
  services: CoffeeServices,
  input: CoffeeHttpInput,
  request: HttpServerRequest,
  path: string,
) => {
  const viaSession = (api: HttpEffect) => domainApi(input, api);
  const served = () =>
    Match.value(routeOf(path)).pipe(
      Match.when("rest", () => viaSession(services.domainRest)),
      Match.when("customer", () => viaSession(services.customerApi)),
      Match.when("staff", () => viaSession(services.staffApi)),
      Match.orElse(() => coffeeHttp(input)),
    );
  return Option.isNone(input.auth) && needsAuth(path)
    ? Effect.succeed(HttpServerResponse.text("Authentication is unavailable.", { status: 503 }))
    : rejectsBearer(path)
      ? rejectBearer(served())
      : served();
};

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
    domain: services.domain,
  };
  const response = yield* routeBackend(services, input, request, path);
  yield* annotateHttpStatus({ routeKind: routeKindOf(routeOf(path)), status: response.status });
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

/** The settings every host's Worker shares; `main` is that Worker's own module. */
export const coffeeWorkerSettings = (main: string) => ({
  main,
  compatibility: { flags: ["nodejs_compat"] },
  observability: {
    enabled: true,
    logs: { enabled: true, invocationLogs: true, persist: true },
    traces: { enabled: true, persist: true },
  },
});

/** The Worker's program over a hosted model: build the services once, then serve. */
export const coffeeWorker = <R>(model: Layer.Layer<HostedModel, never, R>) =>
  Effect.gen(function* () {
    const services: CoffeeServices = {
      deployment: yield* readAuthDeployment(),
      db: yield* Cloudflare.D1.QueryDatabase(yield* AuthDatabase),
      readAuthSecret: yield* Cloudflare.SecretsStore.ReadSecret(yield* authSecret()),
      customerApi: (yield* CustomerApi).fetch,
      staffApi: (yield* StaffApi).fetch,
      domainRest: yield* domainRestHttp,
      app: yield* CoffeeOrderApp,
      domain: yield* Effect.context<DomainToolServices>(),
    };
    return { fetch: serve(services) };
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The Worker program is the application entry point that composes the hosted model.
  }).pipe(Effect.provide(coffeeLive(model)));
