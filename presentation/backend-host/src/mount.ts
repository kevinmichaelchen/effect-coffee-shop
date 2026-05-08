import type { ExecutionContext } from "@cloudflare/workers-types";
import type { StructuredLogRecord } from "./logging.ts";

export interface CloudflareRequestContext<TEnv> {
  readonly env: TEnv;
  readonly executionContext: ExecutionContext;
  readonly request: Request;
}

export interface CloudflareMountResult {
  readonly response: Response;
  readonly logFields?: StructuredLogRecord;
}

export interface CloudflareMount<TEnv> {
  readonly name: string;
  readonly matches: (request: Request) => boolean;
  readonly handle: (context: CloudflareRequestContext<TEnv>) => Promise<CloudflareMountResult>;
}

export const cloudflarePathname = (request: Request): string => new URL(request.url).pathname;

export const cloudflareResponse = (
  response: Response,
  logFields?: StructuredLogRecord,
): CloudflareMountResult => (logFields === undefined ? { response } : { logFields, response });

export const rewriteRequestPath = (request: Request, pathname: string): Request => {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
};
