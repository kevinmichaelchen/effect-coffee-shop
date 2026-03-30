import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { OrderId } from "../../domain/order.ts";
import { OrderIdGenerator } from "../../service/ports/OrderIdGenerator.ts";

const formatOrderId = (currentId: number): OrderId => `order-${String(currentId).padStart(4, "0")}`;

export const InMemoryOrderIdGeneratorLive = Layer.effect(
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
