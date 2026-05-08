import { actorLogFields, logStructuredEvent } from "@effect-coffee-shop/backend-host/logging";
import type { AppActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";

type AssistantToolActivity = {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
};

export function createAssistantGatewayMetadata(actor: AppActor, runId: string) {
  return {
    actor_kind: actor.kind,
    assistant_run_id: runId,
    route_kind: "assistant",
  } as const;
}

export function logAssistantRunStarted(input: {
  readonly actor: AppActor;
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly runId: string;
}): void {
  logStructuredEvent({
    event: "assistant.run.started",
    ...actorLogFields(input.actor),
    assistant_gateway_enabled: input.gatewayEnabled,
    assistant_model: input.model,
    assistant_run_id: input.runId,
  });
}

export function logAssistantRunCompleted(input: {
  readonly actor: AppActor;
  readonly durationMs: number;
  readonly model: string;
  readonly runId: string;
  readonly toolCallCount: number;
}): void {
  logStructuredEvent({
    event: "assistant.run.completed",
    ...actorLogFields(input.actor),
    assistant_duration_ms: Number(input.durationMs.toFixed(2)),
    assistant_model: input.model,
    assistant_run_id: input.runId,
    assistant_tool_call_count: input.toolCallCount,
  });
}

export function logAssistantRunFailed(input: {
  readonly actor: AppActor;
  readonly durationMs: number;
  readonly error: unknown;
  readonly model: string;
  readonly runId: string;
}): void {
  logStructuredEvent({
    event: "assistant.run.error",
    ...actorLogFields(input.actor),
    assistant_duration_ms: Number(input.durationMs.toFixed(2)),
    assistant_model: input.model,
    assistant_run_id: input.runId,
    error_message: String(input.error),
  });
}

export function logAssistantToolActivity(input: {
  readonly activity: AssistantToolActivity;
  readonly actor: AppActor;
  readonly model: string;
  readonly runId: string;
}): void {
  logStructuredEvent({
    event: "assistant.tool.activity",
    ...actorLogFields(input.actor),
    assistant_model: input.model,
    assistant_run_id: input.runId,
    assistant_tool_activity_kind: input.activity.kind,
    assistant_tool_name: input.activity.label,
    assistant_tool_payload: input.activity.detail,
  });
}
