/**
 * Stores checkout sessions in memory for local and test runtimes.
 *
 * @module
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type {
  CheckoutSession,
  CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";

export const InMemoryCheckoutSessionRepositoryLive = Layer.sync(CheckoutSessionRepository, () => {
  const sessions = new Map<CheckoutSessionId, CheckoutSession>();

  const currentSessionForOwner = (ownerUserId: string) =>
    Array.from(sessions.values())
      .filter((session) => session.ownerUserId === ownerUserId)
      .sort(
        (left, right) =>
          DateTime.toEpochMillis(right.updatedAt) - DateTime.toEpochMillis(left.updatedAt),
      )[0];

  return CheckoutSessionRepository.of({
    getById: (id) => Effect.succeed(Option.fromUndefinedOr(sessions.get(id))),
    getCurrentByOwnerUserId: (ownerUserId) =>
      Effect.succeed(Option.fromUndefinedOr(currentSessionForOwner(ownerUserId))),
    save: (session) =>
      Effect.sync(() => {
        sessions.set(session.id, session);
        return session;
      }),
    clearCurrentByOwnerUserId: (ownerUserId) =>
      Effect.sync(() => {
        const current = currentSessionForOwner(ownerUserId);
        if (current !== undefined) {
          sessions.delete(current.id);
        }
      }),
  });
});
