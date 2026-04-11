import type { AppActor } from "#service/CurrentActor";

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

export function logStructuredEvent(record: StructuredLogRecord): void {
  console.log(record);
}

export function logRequestCompleted(input: {
  readonly durationMs: number;
  readonly extraFields?: StructuredLogRecord;
  readonly request: Request;
  readonly response: Response;
  readonly routeKind: string;
}): void {
  logStructuredEvent({
    event: "worker.request.complete",
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
}): void {
  logStructuredEvent({
    event: "worker.request.error",
    ...requestLogFields(input.request, input.routeKind),
    ...input.extraFields,
    duration_ms: roundDurationMs(input.durationMs),
    error_message: String(input.error),
  });
}

function requestLogFields(request: Request, routeKind: string): StructuredLogRecord {
  return {
    cf_ray: request.headers.get("cf-ray"),
    http_method: request.method,
    http_path: new URL(request.url).pathname,
    route_kind: routeKind,
  };
}

function roundDurationMs(durationMs: number): number {
  return Number(durationMs.toFixed(2));
}
