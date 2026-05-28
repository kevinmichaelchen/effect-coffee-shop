import * as Effect from "effect/Effect";

type StructuredLogValue = boolean | number | string | null;
export type StructuredLogRecord = Readonly<Record<string, StructuredLogValue>>;

export const logStructuredEvent = (record: StructuredLogRecord) =>
  Effect.logInfo("structured event").pipe(Effect.annotateLogs(record));

export const logStructuredError = (record: StructuredLogRecord) =>
  Effect.logError("structured event").pipe(Effect.annotateLogs(record));

export function logRequestCompleted(input: {
  readonly durationMs: number;
  readonly extraFields?: StructuredLogRecord;
  readonly request: Request;
  readonly response: Response;
  readonly routeKind: string;
}) {
  return logStructuredEvent({
    event: "http_routing.request.complete",
    ...requestLogFields(input.request, input.routeKind),
    ...input.extraFields,
    duration_ms: roundDurationMs(input.durationMs),
    http_status: input.response.status,
  });
}

export function logRequestFailed(input: {
  readonly durationMs: number;
  readonly error: unknown;
  readonly extraFields?: StructuredLogRecord;
  readonly request: Request;
  readonly routeKind: string;
}) {
  return logStructuredError({
    event: "http_routing.request.error",
    ...requestLogFields(input.request, input.routeKind),
    ...input.extraFields,
    duration_ms: roundDurationMs(input.durationMs),
    error_message: String(input.error),
  });
}

function requestLogFields(request: Request, routeKind: string): StructuredLogRecord {
  return {
    http_method: request.method,
    http_path: new URL(request.url).pathname,
    request_id: request.headers.get("cf-ray") ?? request.headers.get("x-amzn-trace-id"),
    route_kind: routeKind,
  };
}

export function roundDurationMs(durationMs: number): number {
  return Number(durationMs.toFixed(2));
}
