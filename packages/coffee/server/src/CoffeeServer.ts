/**
 * The Coffee Shop backend program, on any host. It serves:
 *
 * - `/api/customer` and `/api/staff`: the domain's `CustomerApi` and
 *   `StaffApi` over Domain RPC, behind the auth session;
 * - `/api/rest/customer` and `/api/rest/staff`: the same Apis as REST, with
 *   an OpenAPI document at `/api/rest/openapi.json`, behind the auth session;
 * - `/api/auth/*`, `/oauth/*`, `/.well-known/*`: Yielded Auth and MCP OAuth;
 * - `/api/health`, `/api/menu`, `/api/me`: REST;
 * - `/api/telemetry/*`: OTLP batches a browser exported, forwarded to wherever
 *   the Worker sends its own telemetry;
 * - `/mcp`: remote MCP tools over the same model, generated from the same Apis.
 *
 * It names no provider. A Worker in `hosts/` provides the model's host (from
 * `hosts/model/`) and the three services declared here, `AuthStorage`,
 * `AuthSecret` and `TelemetryRelay` (from `hosts/edge/`). The tests run the
 * same model on `Domain.InMemory` instead.
 *
 * The static services are built once, here; the auth-dependent surface is built
 * once per `AUTH_SECRET` in `Generation.ts`. Each request reads the secret and
 * picks a generation, so nothing request-bound outlives its request.
 *
 * @module
 */
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { readAuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import type { AuthDatabase } from "@effect-coffee-shop/coffee-auth/server";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { domainRestHttp } from "@effect-coffee-shop/coffee-http/domain-rest";
import { annotateHttpStatus, withHttpWideEvent } from "@effect-coffee-shop/http-routing/logging";
import type { HttpEffect } from "alchemy/Http";
import { RuntimeContext } from "alchemy/RuntimeContext";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HttpServerError from "effect/http/HttpServerError";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import { WideEventLogger } from "effect-wide-event";
import {
  type CoffeeDeployment,
  type CoffeeGeneration,
  type DomainToolServices,
  domainApi,
  signedIn,
} from "./CoffeeHttp.ts";
import { type CoffeeGenerations, coffeeGenerations } from "./Generation.ts";
import { rejectBearer, type RouteRow, routeFor, routeKindOf } from "./Routes.ts";
import { SessionLive } from "./Session.ts";

/** Where auth keeps its state: the database every generation of the secret builds once. */
export class AuthStorage extends Context.Service<
  AuthStorage,
  { readonly database: Effect.Effect<AuthDatabase, never, RuntimeContext> }
>()("@effect-coffee-shop/coffee-server/CoffeeServer/AuthStorage") {}

/** The secret could not be read; auth is then off for the request. */
export class AuthSecretUnavailable extends Schema.TaggedError<
  AuthSecretUnavailable,
  { readonly brand: unique symbol }
>()("AuthSecretUnavailable", {}) {}

/** The auth request-binding secret, read once per request. */
export class AuthSecret extends Context.Service<
  AuthSecret,
  { readonly read: Effect.Effect<Redacted.Redacted, AuthSecretUnavailable, RuntimeContext> }
>()("@effect-coffee-shop/coffee-server/CoffeeServer/AuthSecret") {}

/**
 * The Worker's own telemetry destinations, as a receiver for the OTLP batches
 * a browser exports. The host provides it, so an ingest token never reaches
 * the browser and the Worker forwards each batch with its own credentials.
 */
export class TelemetryRelay extends Context.Service<
  TelemetryRelay,
  {
    /** The OTLP/HTTP receiver; `authorize` decides whether a batch is accepted. */
    readonly receive: (authorize: Effect.Effect<boolean, never, HttpServerRequest>) => HttpEffect;
  }
>()("@effect-coffee-shop/coffee-server/CoffeeServer/TelemetryRelay") {}

interface CoffeeServices {
  readonly generations: CoffeeGenerations;
  readonly secret: AuthSecret["Service"];
  readonly customerApi: HttpEffect;
  readonly staffApi: HttpEffect;
  readonly domainRest: HttpEffect;
  readonly telemetry: TelemetryRelay["Service"];
}

/**
 * The surface that serves this row of the route table: the domain Apis behind
 * the session, the telemetry relay for a signed-in browser, and the router for
 * auth, REST and MCP.
 */
const servedBy = (
  services: CoffeeServices,
  generation: CoffeeGeneration,
  request: HttpServerRequest,
  row: RouteRow,
) =>
  Match.value(row.route).pipe(
    Match.when("rest", () => domainApi(generation, services.domainRest)),
    Match.when("customer", () => domainApi(generation, services.customerApi)),
    Match.when("staff", () => domainApi(generation, services.staffApi)),
    Match.when("telemetry", () => services.telemetry.receive(signedIn(generation, request))),
    Match.orElse(() => generation.http),
  );

/** Answer a request through the surface its row names, or 503 when it needs the auth it lacks. */
const routeBackend = (
  services: CoffeeServices,
  generation: CoffeeGeneration,
  request: HttpServerRequest,
  row: RouteRow,
) => {
  const served = () => servedBy(services, generation, request, row);
  return Option.isNone(generation.auth) && row.needsAuth
    ? Effect.succeed(HttpServerResponse.text("Authentication is unavailable.", { status: 503 }))
    : row.rejectsBearer
      ? rejectBearer(served())
      : served();
};

/** Route one request: pick the generation its secret builds, then serve it. */
const handleRequest = Effect.fn("CoffeeWorker.fetch")(function* (services: CoffeeServices) {
  const request = yield* HttpServerRequest;
  const path = new URL(request.url, "http://localhost").pathname;
  // A missing or unreadable secret disables auth: auth paths answer 503, the
  // rest anonymously. That surface is never cached.
  const generation = yield* services.generations.forRequest(services.secret.read);
  const row = routeFor(path);
  const response = yield* routeBackend(services, generation, request, row);
  yield* annotateHttpStatus({
    routeKind: routeKindOf(row.route),
    status: response.status,
  });
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

/**
 * The program a host's Worker runs: build the services once, then serve. It
 * needs the hosted model, `AuthStorage`, `AuthSecret` and `TelemetryRelay`.
 */
export const coffeeServer = Effect.gen(function* () {
  const storage = yield* AuthStorage;
  const deployment: CoffeeDeployment = {
    auth: yield* readAuthDeployment(),
    database: yield* storage.database,
    app: yield* CoffeeOrderApp,
    domain: yield* Effect.context<DomainToolServices>(),
  };
  const services: CoffeeServices = {
    generations: yield* coffeeGenerations(deployment),
    secret: yield* AuthSecret,
    customerApi: (yield* CustomerApi).fetch,
    staffApi: (yield* StaffApi).fetch,
    domainRest: yield* domainRestHttp,
    telemetry: yield* TelemetryRelay,
  };
  return { fetch: serve(services) };
}).pipe(
  // The Worker's init runs with the instance's `RuntimeContext` in fact but
  // not in its type, and reading the D1 binding only needs the env it holds:
  // `phantom` names the context without providing a value.
  // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The Worker's init is this program's entry point, which owns layer assembly; the session, app, logging and named context are provided once, here.
  Effect.provide(
    Layer.mergeAll(SessionLive, CoffeeOrderApp.layer, RuntimeContext.phantom).pipe(
      Layer.provideMerge(WideEventLogger.Json),
    ),
  ),
);
