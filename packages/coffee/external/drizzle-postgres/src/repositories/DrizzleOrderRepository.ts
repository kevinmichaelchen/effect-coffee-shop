/**
 * Persists Coffee orders with Drizzle/Postgres.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { CoffeeDb } from "../db/Db.ts";
import { listOrders, loadOrderById, saveOrder } from "./order-persistence.ts";

export const DrizzleOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    return OrderRepository.of({
      save: (order) =>
        saveOrder(db, order).pipe(PersistenceError.refail(`Failed to save order "${order.id}"`)),
      getById: (orderId) =>
        loadOrderById(db, orderId).pipe(
          PersistenceError.refail(`Failed to load order "${orderId}"`),
        ),
      list: (filters) =>
        listOrders(db, filters).pipe(PersistenceError.refail("Failed to list coffee orders")),
    });
  }),
);
