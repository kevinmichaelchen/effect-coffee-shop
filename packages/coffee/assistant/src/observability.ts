import {
  actorLogFields,
  logStructuredEvent,
  roundDurationMs,
} from "@effect-coffee-shop/backend-host/logging";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

type AssistantToolActivity = {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
};

interface AssistantRunLogFieldsInput {
  readonly actor: AppActor;
  readonly model: string;
  readonly runId: string;
}

interface AssistantTimedRunLogFieldsInput extends AssistantRunLogFieldsInput {
  readonly durationMs: number;
}

const assistantRunLogFields = (input: AssistantRunLogFieldsInput) => ({
  ...actorLogFields(input.actor),
  assistant_model: input.model,
  assistant_run_id: input.runId,
});

const assistantTimedRunLogFields = (input: AssistantTimedRunLogFieldsInput) => ({
  ...assistantRunLogFields(input),
  assistant_duration_ms: roundDurationMs(input.durationMs),
});

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
    ...assistantRunLogFields(input),
    assistant_gateway_enabled: input.gatewayEnabled,
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
    ...assistantTimedRunLogFields(input),
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
    ...assistantTimedRunLogFields(input),
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
    ...assistantRunLogFields(input),
    assistant_tool_activity_kind: input.activity.kind,
    assistant_tool_name: input.activity.label,
    assistant_tool_payload: input.activity.detail,
  });
}
