/**
 * Which Coffee Worker surface serves a path, and the rules each one has: one
 * row per surface says whether it needs auth configured and whether it turns
 * away bearer tokens. The table is ordered: the first row with a matching
 * prefix wins, so `/api/rest` is matched before the generic `/api` routes.
 * Every prefix sits under `backendPrefixes`, the list the app forwards.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { HttpServerRequest } from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Option from "effect/Option";
import { isOrStartsWith } from "@effect-coffee-shop/coffee-routes";
import { domainRestPrefix } from "@effect-coffee-shop/coffee-http/domain-rest";

/** A surface of the Worker. */
export type Route = "rest" | "customer" | "staff" | "auth" | "mcp" | "api" | "unmatched";

interface RouteRow {
  readonly route: Route;
  readonly prefixes: ReadonlyArray<string>;
  /** Without auth configured, the surface answers 503. */
  readonly needsAuth: boolean;
  /**
   * App routes authenticate with session cookies, never with an agent's
   * bearer token; agents use MCP instead.
   */
  readonly rejectsBearer: boolean;
}

export const routeTable: ReadonlyArray<RouteRow> = [
  { route: "rest", prefixes: [domainRestPrefix], needsAuth: false, rejectsBearer: true },
  { route: "customer", prefixes: ["/api/customer"], needsAuth: false, rejectsBearer: true },
  { route: "staff", prefixes: ["/api/staff"], needsAuth: false, rejectsBearer: true },
  { route: "auth", prefixes: ["/api/auth"], needsAuth: true, rejectsBearer: true },
  { route: "auth", prefixes: ["/oauth", "/.well-known"], needsAuth: true, rejectsBearer: false },
  { route: "mcp", prefixes: ["/mcp"], needsAuth: true, rejectsBearer: false },
  { route: "api", prefixes: ["/api"], needsAuth: false, rejectsBearer: true },
];

const unmatched: RouteRow = {
  route: "unmatched",
  prefixes: [],
  needsAuth: false,
  rejectsBearer: false,
};

/** The row that serves this path. */
export const routeFor = (path: string): RouteRow =>
  Arr.findFirst(routeTable, ({ prefixes }) =>
    prefixes.some((prefix) => isOrStartsWith(path, prefix)),
  ).pipe(Option.getOrElse(() => unmatched));

/** The surface that serves this path. */
export const routeOf = (path: string): Route => routeFor(path).route;

/** The route kind recorded on the request's wide event: both domain Apis are `domain`. */
export const routeKindOf = (route: Route) =>
  route === "customer" || route === "staff" ? "domain" : route;

const hasBearerAuthorization = (request: HttpServerRequest) =>
  Option.fromNullishOr(request.headers.authorization).pipe(
    Option.exists((value) => value.trimStart().toLowerCase().startsWith("bearer ")),
  );

/** Answer 400 to a request that carries a bearer token; otherwise serve it. */
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
