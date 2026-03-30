import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { CoffeeOrder, ListOrdersFilters } from "../../domain/order.ts";
import { OrderRepository } from "../../service/ports/OrderRepository.ts";

export const InMemoryOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.sync(() => {
    const orders = new Map<string, CoffeeOrder>();
    let currentId = 0;

    return OrderRepository.of({
      nextId: Effect.sync(() => {
        currentId += 1;
        return `order-${String(currentId).padStart(4, "0")}`;
      }),
      save: (order) =>
        Effect.sync(() => {
          orders.set(order.id, order);
          return order;
        }),
      getById: (orderId) => Effect.succeed(orders.get(orderId)),
      list: (filters: ListOrdersFilters = {}) =>
        Effect.succeed(
          Array.from(orders.values())
            .filter((order) => filters.status === undefined || order.status === filters.status)
            .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
        ),
    });
  }),
);
