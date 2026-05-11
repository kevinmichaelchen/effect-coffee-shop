import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  checkoutSessionIdFromString,
  type CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";

const formatCheckoutSessionId = (currentId: number): CheckoutSessionId =>
  checkoutSessionIdFromString(`checkout-session-${String(currentId).padStart(4, "0")}`);

export const InMemoryCheckoutSessionIdGeneratorLive = Layer.effect(
  CheckoutSessionIdGenerator,
  Effect.sync(() => {
    let currentId = 0;

    return CheckoutSessionIdGenerator.of({
      next: Effect.sync(() => {
        currentId += 1;
        return formatCheckoutSessionId(currentId);
      }),
    });
  }),
);
