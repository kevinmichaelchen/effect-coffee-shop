/**
 * Which Coffee Worker surface serves a path. The table is ordered: the first
 * entry with a matching prefix wins, so `/api/rest` is matched before the
 * generic `/api` routes.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { domainRestPrefix } from "@effect-coffee-shop/coffee-http/domain-rest";

/** The path is `prefix` itself or below it (Effect RPC clients post to `prefix/`). */
export const isOrStartsWith = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** Paths that need auth configured: without it they answer 503. */
export const needsAuth = (path: string) =>
  isOrStartsWith(path, "/api/auth") ||
  isOrStartsWith(path, "/sync") ||
  isOrStartsWith(path, "/mcp") ||
  path.startsWith("/oauth/") ||
  path.startsWith("/.well-known/");

/** A surface of the Worker. */
export type Route = "sync" | "rest" | "customer" | "staff" | "auth" | "mcp" | "api" | "unmatched";

const routeTable: ReadonlyArray<{
  readonly route: Route;
  readonly prefixes: ReadonlyArray<string>;
}> = [
  { route: "sync", prefixes: ["/sync"] },
  { route: "rest", prefixes: [domainRestPrefix] },
  { route: "customer", prefixes: ["/api/customer"] },
  { route: "staff", prefixes: ["/api/staff"] },
  { route: "auth", prefixes: ["/api/auth", "/oauth", "/.well-known"] },
  { route: "mcp", prefixes: ["/mcp"] },
  { route: "api", prefixes: ["/api"] },
];

/** The surface that serves this path. */
export const routeOf = (path: string): Route =>
  Arr.findFirst(routeTable, ({ prefixes }) =>
    prefixes.some((prefix) => isOrStartsWith(path, prefix)),
  ).pipe(
    Option.map(({ route }) => route),
    Option.getOrElse((): Route => "unmatched"),
  );

/** The route kind recorded on the request's wide event: both domain Apis are `domain`. */
export const routeKindOf = (route: Route) =>
  route === "customer" || route === "staff" ? "domain" : route;

/**
 * App routes (`/api`, `/sync`) authenticate with session cookies, never with
 * an agent's bearer token; agents use MCP instead.
 */
export const rejectsBearer = (path: string) => path.startsWith("/api") || path.startsWith("/sync");
