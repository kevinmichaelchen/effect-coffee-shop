/**
 * Defines Fetch host route contracts and request path helpers.
 *
 * @module
 */
import type * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import type { StructuredLogRecord } from "./logging.ts";

export interface HostRuntimeContext {
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

export interface FetchRequestContext<TEnv> {
  readonly env: TEnv;
  readonly request: Request;
  readonly runtime: HostRuntimeContext;
}

export interface FetchRouteResult {
  readonly response: Response;
  readonly logFields?: StructuredLogRecord;
}

export type FetchRouteEffect = ReturnType<typeof Effect.suspend<FetchRouteResult, unknown, never>>;

export interface FetchRoute<TEnv> {
  readonly name: string;
  readonly matches: (request: Request) => boolean;
  readonly handle: (context: FetchRequestContext<TEnv>) => FetchRouteEffect;
}

export const requestPathname = (request: Request): string => new URL(request.url).pathname;

export const requestPathEquals = (request: Request, pathname: string): boolean =>
  requestPathname(request) === pathname;

export const requestPathIsOrStartsWith = (request: Request, pathname: string): boolean => {
  const pathnameFromRequest = requestPathname(request);
  return pathnameFromRequest === pathname || pathnameFromRequest.startsWith(`${pathname}/`);
};

export const fetchResponse = (
  response: Response,
  logFields?: StructuredLogRecord,
): FetchRouteResult =>
  Option.match(Option.fromUndefinedOr(logFields), {
    onNone: () => ({ response }),
    onSome: (extraFields) => ({ logFields: extraFields, response }),
  });

export const rewriteRequestPath = (request: Request, pathname: string): Request => {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
};

export const rewriteRequestPathPrefix = (request: Request, prefix: string): Request => {
  const pathname = requestPathname(request);
  const rewrittenPathname = Option.match(
    Option.liftPredicate(pathname, (requestPathname) => requestPathname === prefix),
    {
      onNone: () => pathname.slice(prefix.length),
      onSome: () => "/",
    },
  );
  return rewriteRequestPath(request, rewrittenPathname);
};
