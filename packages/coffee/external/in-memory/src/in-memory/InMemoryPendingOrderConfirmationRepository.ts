import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { PendingOrderConfirmation } from "@effect-coffee-shop/coffee-core/domain/pending-order-confirmation";
import { PendingOrderConfirmationRepository } from "@effect-coffee-shop/coffee-core/application/ports/PendingOrderConfirmationRepository";

export const InMemoryPendingOrderConfirmationRepositoryLive = Layer.effect(
  PendingOrderConfirmationRepository,
  Effect.sync(() => {
    const confirmations = new Map<string, PendingOrderConfirmation>();

    return PendingOrderConfirmationRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        Effect.succeed(Option.fromUndefinedOr(confirmations.get(ownerUserId))),
      save: (confirmation) =>
        Effect.sync(() => {
          confirmations.set(confirmation.ownerUserId, confirmation);
          return confirmation;
        }),
      clear: (ownerUserId) =>
        Effect.sync(() => {
          confirmations.delete(ownerUserId);
        }),
    });
  }),
);
