import * as Effect from "effect/Effect";
import type { AppActor } from "@effect-coffee-shop/core/service/CurrentActor";

type ObservabilityValue = boolean | number | string | null;
type ObservabilityAttributes = Readonly<Record<string, ObservabilityValue>>;

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
