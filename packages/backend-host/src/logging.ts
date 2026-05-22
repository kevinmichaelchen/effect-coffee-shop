import * as Effect from "effect/Effect";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

type StructuredLogValue = boolean | number | string | null;
export type StructuredLogRecord = Readonly<Record<string, StructuredLogValue>>;

export function actorLogFields(actor: AppActor | undefined): StructuredLogRecord {
  if (actor === undefined) {
    return {};
  }

  if (actor.kind === "anonymous") {
    return {
      actor_kind: actor.kind,
    };
  }

  return {
    actor_kind: actor.kind,
    actor_user_id: actor.userId,
  };
}

export function logStructuredEvent(record: StructuredLogRecord) {
  return Effect.logInfo("structured event").pipe(Effect.annotateLogs(record));
}

export function logStructuredError(record: StructuredLogRecord) {
  return Effect.logError("structured event").pipe(Effect.annotateLogs(record));
}

export function logRequestCompleted(input: {
  readonly durationMs: number;
  readonly extraFields?: StructuredLogRecord;
  readonly request: Request;
  readonly response: Response;
  readonly routeKind: string;
}) {
  return logStructuredEvent({
    event: "fetch_host.request.complete",
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
    event: "fetch_host.request.error",
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
