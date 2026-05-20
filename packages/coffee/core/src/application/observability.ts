import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import type { AppActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

type ObservabilityValue = boolean | number | string | null;
type ObservabilityAttributes = Readonly<Record<string, ObservabilityValue>>;
type MetricAttributes = Readonly<Record<string, string>>;

const orderActionsTotal = Metric.counter("coffee_order_actions_total", {
  description: "Total coffee order application actions by actor kind, action, result, and status.",
  incremental: true,
});

export function actorObservabilityAttributes(actor: AppActor): ObservabilityAttributes {
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

export function annotateObservabilitySpan(attributes: ObservabilityAttributes) {
  return Effect.annotateCurrentSpan(attributes);
}

export function logInfoWithAttributes(message: string, attributes: ObservabilityAttributes) {
  return Effect.logInfo(message).pipe(Effect.annotateLogs(attributes));
}

export function recordOrderAction(input: {
  readonly action: string;
  readonly actor: AppActor;
  readonly result: "error" | "success";
  readonly status?: string;
}) {
  const attributes: MetricAttributes = Option.match(Option.fromUndefinedOr(input.status), {
    onNone: () => ({
      actor_kind: input.actor.kind,
      order_action: input.action,
      result: input.result,
    }),
    onSome: (status) => ({
      actor_kind: input.actor.kind,
      order_action: input.action,
      order_status: status,
      result: input.result,
    }),
  });

  return Metric.update(Metric.withAttributes(orderActionsTotal, attributes), 1);
}
