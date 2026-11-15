/**
 * The Coffee Shop backend program, on any host. It serves:
 *
 * - `/api/customer` and `/api/staff`: the domain's `CustomerApi` and
 *   `StaffApi` over Domain RPC, behind the auth session;
 * - `/api/rest/customer` and `/api/rest/staff`: the same Apis as REST, with
 *   an OpenAPI document at `/api/rest/openapi.json`, behind the auth session;
 * - `/api/auth/*`, `/oauth/*`, `/.well-known/*`: Yielded Auth and MCP OAuth;
 * - `/api/health`, `/api/menu`, `/api/me`: REST;
 * - `/mcp`: remote MCP tools over the same model, generated from the same Apis.
 *
 * It names no provider. A host's Worker provides the model (`CoffeeShopLive`
 * or `CoffeeShopRivet`) and the two services declared here, `AuthStorage` and
 * `AuthSecret` (see `adapters/cloudflare.ts`). The tests run the same model on
 * `Domain.InMemory` instead.
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
  rejectBearer,
} from "./CoffeeHttp.ts";
import { needsAuth, rejectsBearer, routeKindOf, routeOf } from "./Routes.ts";
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

interface CoffeeServices {
  readonly deployment: AuthDeployment;
  readonly storage: AuthStorage["Service"];
  readonly secret: AuthSecret["Service"];
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
  const secret = yield* services.secret.read.pipe(Effect.option);
  const input = {
    auth: Option.map(secret, (secret) => ({ ...services.deployment, secret })),
    database: yield* services.storage.database,
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
