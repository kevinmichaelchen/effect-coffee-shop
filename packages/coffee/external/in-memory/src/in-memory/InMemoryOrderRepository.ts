import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { CoffeeOrder, ListOrdersFilters } from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/service/ports/OrderRepository";

export const InMemoryOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.sync(() => {
    const orders = new Map<string, CoffeeOrder>();

    return OrderRepository.of({
      save: (order) =>
        Effect.sync(() => {
          orders.set(order.id, order);
          return order;
        }),
      getById: (orderId) => Effect.succeed(Option.fromUndefinedOr(orders.get(orderId))),
      list: (filters: ListOrdersFilters = {}) =>
        Effect.succeed(
          Array.from(orders.values())
            .filter(
              (order) =>
                filters.ownerUserId === undefined || order.ownerUserId === filters.ownerUserId,
            )
            .filter((order) => filters.status === undefined || order.status === filters.status)
            .sort(
              (left, right) =>
                DateTime.toEpochMillis(left.createdAt) - DateTime.toEpochMillis(right.createdAt),
            ),
        ),
    });
  }),
);
