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
 * @module
 */
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { type AuthDeployment, readAuthDeployment } from "@effect-coffee-shop/coffee-auth/config";
import type { AuthDatabase } from "@effect-coffee-shop/coffee-auth/server";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import { domainRestHttp } from "@effect-coffee-shop/coffee-http/domain-rest";
import { annotateHttpStatus, withHttpWideEvent } from "@effect-coffee-shop/http-routing/logging";
import type { HttpEffect } from "alchemy/Http";
import type { RuntimeContext } from "alchemy/RuntimeContext";
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
  type CoffeeHttpInput,
  coffeeHttp,
  domainApi,
  type DomainToolServices,
  signedIn,
} from "./CoffeeHttp.ts";
import { rejectBearer, routeFor, routeKindOf } from "./Routes.ts";
import { SessionLive } from "./Session.ts";

/** Where auth keeps its state, opened once per request. */
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
  readonly deployment: AuthDeployment;
  readonly storage: AuthStorage["Service"];
  readonly secret: AuthSecret["Service"];
  readonly customerApi: HttpEffect;
  readonly staffApi: HttpEffect;
  readonly domainRest: HttpEffect;
  readonly app: CoffeeOrderApp["Service"];
  readonly domain: CoffeeHttpInput["domain"];
  readonly telemetry: TelemetryRelay["Service"];
}

const routeBackend = (
  services: CoffeeServices,
  input: CoffeeHttpInput,
  request: HttpServerRequest,
  path: string,
) => {
  const row = routeFor(path);
  const viaSession = (api: HttpEffect) => domainApi(input, api);
  const served = () =>
    Match.value(row.route).pipe(
      Match.when("rest", () => viaSession(services.domainRest)),
      Match.when("customer", () => viaSession(services.customerApi)),
      Match.when("staff", () => viaSession(services.staffApi)),
      Match.when("telemetry", () => services.telemetry.receive(signedIn(input, request))),
      Match.orElse(() => coffeeHttp(input)),
    );
  return Option.isNone(input.auth) && row.needsAuth
    ? Effect.succeed(HttpServerResponse.text("Authentication is unavailable.", { status: 503 }))
    : row.rejectsBearer
      ? rejectBearer(served())
      : served();
};

/** Route one request: the domain Apis, auth, REST and MCP. */
const handleRequest = Effect.fn("CoffeeWorker.fetch")(function* (services: CoffeeServices) {
  const request = yield* HttpServerRequest;
  const path = new URL(request.url, "http://localhost").pathname;
  // A missing or unreadable secret disables auth: auth paths answer 503, the rest anonymously.
  const secret = yield* services.secret.read.pipe(Effect.option);
  const input = {
    auth: Option.map(secret, (secret) => ({ ...services.deployment, secret })),
    database: yield* services.storage.database,
    app: services.app,
    domain: services.domain,
  };
  const response = yield* routeBackend(services, input, request, path);
  yield* annotateHttpStatus({
    routeKind: routeKindOf(routeFor(path).route),
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
 * needs the hosted model, `AuthStorage` and `AuthSecret`.
 */
export const coffeeServer = Effect.gen(function* () {
  const services: CoffeeServices = {
    deployment: yield* readAuthDeployment(),
    storage: yield* AuthStorage,
    secret: yield* AuthSecret,
    customerApi: (yield* CustomerApi).fetch,
    staffApi: (yield* StaffApi).fetch,
    domainRest: yield* domainRestHttp,
    app: yield* CoffeeOrderApp,
    domain: yield* Effect.context<DomainToolServices>(),
    telemetry: yield* TelemetryRelay,
  };
  return { fetch: serve(services) };
}).pipe(
  // oxlint-disable-next-line effecttsgo/strict-effect-provide -- The program provides its own session, app and logging layers; the host's Worker provides the rest.
  Effect.provide(
    Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
      Layer.provideMerge(WideEventLogger.Json),
    ),
  ),
);
