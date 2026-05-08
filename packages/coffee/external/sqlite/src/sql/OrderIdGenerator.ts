import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";

const formatOrderId = (currentId: number): OrderId => `order-${String(currentId).padStart(4, "0")}`;

export const SqlOrderIdGeneratorLive = Layer.effect(
  OrderIdGenerator,
  Effect.sync(() => {
    let currentId = 0;

    return OrderIdGenerator.of({
      next: Effect.sync(() => {
        currentId += 1;
        return formatOrderId(currentId);
      }),
    });
  }),
);
