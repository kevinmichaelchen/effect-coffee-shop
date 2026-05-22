/**
 * Stores Coffee orders in memory for local and test runtimes.
 *
 * @module
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type {
  CoffeeOrder,
  ListOrdersFilters,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";

export const InMemoryOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function* () {
    const orders = yield* Ref.make(HashMap.empty<OrderId, CoffeeOrder>());

    return OrderRepository.of({
      save: (order) => Ref.update(orders, HashMap.set(order.id, order)).pipe(Effect.as(order)),
      getById: (orderId) => Ref.get(orders).pipe(Effect.map(HashMap.get(orderId))),
      list: (filters: ListOrdersFilters = {}) =>
        Ref.get(orders).pipe(
          Effect.map((currentOrders) =>
            Array.from(HashMap.values(currentOrders))
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
        ),
    });
  }),
);
