/**
 * Defines Fetch host mount contracts and request path helpers.
 *
 * @module
 */
import type { StructuredLogRecord } from "./logging.ts";

export interface HostRuntimeContext {
  readonly waitUntil?: (promise: Promise<unknown>) => void;
}

export interface FetchRequestContext<TEnv> {
  readonly env: TEnv;
  readonly request: Request;
  readonly runtime: HostRuntimeContext;
}

export interface FetchMountResult {
  readonly response: Response;
  readonly logFields?: StructuredLogRecord;
}

export interface FetchMount<TEnv> {
  readonly name: string;
  readonly matches: (request: Request) => boolean;
  readonly handle: (context: FetchRequestContext<TEnv>) => Promise<FetchMountResult>;
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
): FetchMountResult => (logFields === undefined ? { response } : { logFields, response });

export const rewriteRequestPath = (request: Request, pathname: string): Request => {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
};

export const rewriteRequestPathPrefix = (request: Request, prefix: string): Request => {
  const pathname = requestPathname(request);
  const rewrittenPathname = pathname === prefix ? "/" : pathname.slice(prefix.length);
  return rewriteRequestPath(request, rewrittenPathname);
};
