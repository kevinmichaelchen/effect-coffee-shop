/**
 * Records assistant run metrics and structured log events.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import {
  actorLogFields,
  logStructuredEvent,
  logStructuredError,
  roundDurationMs,
} from "@effect-coffee-shop/backend-host/logging";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

type AssistantToolActivity = {
  readonly detail: string;
  readonly kind: "tool-call" | "tool-result";
  readonly label: string;
};

type MetricAttributes = Readonly<Record<string, string>>;

const assistantRunsTotal = Metric.counter("assistant_runs_total", {
  description: "Total assistant runs by model, gateway mode, and outcome.",
  incremental: true,
});

const assistantRunDurationMs = Metric.histogram("assistant_run_duration_ms", {
  description: "Assistant run duration in milliseconds.",
  boundaries: Metric.exponentialBoundaries({ start: 10, factor: 2, count: 16 }),
});

const assistantToolActivityTotal = Metric.counter("assistant_tool_activity_total", {
  description: "Total assistant tool calls and tool results by model and tool.",
  incremental: true,
});

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

const assistantRunMetricAttributes = (input: {
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly outcome: string;
}): MetricAttributes => ({
  assistant_gateway_enabled: String(input.gatewayEnabled),
  assistant_model: input.model,
  outcome: input.outcome,
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
}) {
  return Effect.gen(function* () {
    yield* Metric.update(
      Metric.withAttributes(
        assistantRunsTotal,
        assistantRunMetricAttributes({
          gatewayEnabled: input.gatewayEnabled,
          model: input.model,
          outcome: "started",
        }),
      ),
      1,
    );
    yield* logStructuredEvent({
      event: "assistant.run.started",
      ...assistantRunLogFields(input),
      assistant_gateway_enabled: input.gatewayEnabled,
    });
  });
}

export function logAssistantRunCompleted(input: {
  readonly actor: AppActor;
  readonly durationMs: number;
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly runId: string;
  readonly toolCallCount: number;
}) {
  const attributes = assistantRunMetricAttributes({
    gatewayEnabled: input.gatewayEnabled,
    model: input.model,
    outcome: "success",
  });

  return Effect.gen(function* () {
    yield* Metric.update(Metric.withAttributes(assistantRunsTotal, attributes), 1);
    yield* Metric.update(
      Metric.withAttributes(assistantRunDurationMs, attributes),
      roundDurationMs(input.durationMs),
    );
    yield* logStructuredEvent({
      event: "assistant.run.completed",
      ...assistantTimedRunLogFields(input),
      assistant_tool_call_count: input.toolCallCount,
    });
  });
}

export function logAssistantRunFailed(input: {
  readonly actor: AppActor;
  readonly durationMs: number;
  readonly error: unknown;
  readonly gatewayEnabled: boolean;
  readonly model: string;
  readonly runId: string;
}) {
  const attributes = assistantRunMetricAttributes({
    gatewayEnabled: input.gatewayEnabled,
    model: input.model,
    outcome: "error",
  });

  return Effect.gen(function* () {
    yield* Metric.update(Metric.withAttributes(assistantRunsTotal, attributes), 1);
    yield* Metric.update(
      Metric.withAttributes(assistantRunDurationMs, attributes),
      roundDurationMs(input.durationMs),
    );
    yield* logStructuredError({
      event: "assistant.run.error",
      ...assistantTimedRunLogFields(input),
      error_message: String(input.error),
    });
  });
}

export function logAssistantToolActivity(input: {
  readonly activity: AssistantToolActivity;
  readonly actor: AppActor;
  readonly model: string;
  readonly runId: string;
}) {
  return Effect.gen(function* () {
    yield* Metric.update(
      Metric.withAttributes(assistantToolActivityTotal, {
        assistant_model: input.model,
        assistant_tool_activity_kind: input.activity.kind,
        assistant_tool_name: input.activity.label,
      }),
      1,
    );
    yield* logStructuredEvent({
      event: "assistant.tool.activity",
      ...assistantRunLogFields(input),
      assistant_tool_activity_kind: input.activity.kind,
      assistant_tool_name: input.activity.label,
      assistant_tool_payload: input.activity.detail,
    });
  });
}
