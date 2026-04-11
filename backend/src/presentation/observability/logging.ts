import type { AppActor } from "#service/CurrentActor";

export type RequestRouteKind = "agent-discovery" | "api" | "assistant" | "assets" | "auth" | "mcp";

type StructuredLogValue = boolean | number | string | null;
type StructuredLogRecord = Readonly<Record<string, StructuredLogValue>>;

export function routeKindFromPathname(pathname: string): RequestRouteKind {
  if (pathname === "/.well-known/agent-configuration") {
    return "agent-discovery";
  }

  if (pathname === "/api/assistant" || pathname === "/api/assistant/") {
    return "assistant";
  }

  if (pathname === "/api/auth" || pathname.startsWith("/api/auth/")) {
    return "auth";
  }

  if (pathname === "/api" || pathname.startsWith("/api/")) {
    return "api";
  }

  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) {
    return "mcp";
  }

  return "assets";
}

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
  readonly actor: AppActor | undefined;
  readonly durationMs: number;
  readonly request: Request;
  readonly response: Response;
  readonly routeKind: RequestRouteKind;
}): void {
  logStructuredEvent({
    event: "worker.request.complete",
    ...requestLogFields(input.request, input.routeKind),
    ...actorLogFields(input.actor),
    duration_ms: roundDurationMs(input.durationMs),
    http_status: input.response.status,
  });
}

export function logRequestFailed(input: {
  readonly actor: AppActor | undefined;
  readonly durationMs: number;
  readonly error: unknown;
  readonly request: Request;
  readonly routeKind: RequestRouteKind;
}): void {
  logStructuredEvent({
    event: "worker.request.error",
    ...requestLogFields(input.request, input.routeKind),
    ...actorLogFields(input.actor),
    duration_ms: roundDurationMs(input.durationMs),
    error_message: String(input.error),
  });
}

function requestLogFields(request: Request, routeKind: RequestRouteKind): StructuredLogRecord {
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
