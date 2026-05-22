/**
 * Persists Coffee orders with Drizzle/Postgres.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { and, asc, eq } from "drizzle-orm";
import type {
  CoffeeOrder,
  ListOrdersFilters,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { CoffeeDb } from "../db/Db.ts";
import {
  DrizzleOrderItemRowSchema,
  DrizzleOrderRowSchema,
  toCoffeeOrder,
  toOrderInsert,
  toOrderItemInsert,
} from "../db/models.ts";
import { orderItemsTable, ordersTable } from "../db/schema.ts";

const decodeOrderRow = Schema.decodeUnknownEffect(DrizzleOrderRowSchema);
const decodeOrderRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleOrderRowSchema));
const decodeOrderItemRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleOrderItemRowSchema));

const listWhere = (filters: ListOrdersFilters) =>
  and(
    Option.getOrUndefined(
      Option.fromUndefinedOr(filters.ownerUserId).pipe(
        Option.map((ownerUserId) => eq(ordersTable.ownerUserId, ownerUserId)),
      ),
    ),
    Option.getOrUndefined(
      Option.fromUndefinedOr(filters.status).pipe(
        Option.map((status) => eq(ordersTable.status, status)),
      ),
    ),
  );

export const DrizzleOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    const loadOrderItems = Effect.fnUntraced(function* (orderId: OrderId) {
      return yield* db
        .select()
        .from(orderItemsTable)
        .where(eq(orderItemsTable.orderId, orderId))
        .orderBy(asc(orderItemsTable.position))
        .pipe(Effect.flatMap(decodeOrderItemRows));
    });

    const hydrateOrder = Effect.fnUntraced(function* (order: typeof DrizzleOrderRowSchema.Type) {
      const items = yield* loadOrderItems(order.id);
      return toCoffeeOrder(order, items);
    });

    const decodeOptionalOrder = (rows: ReadonlyArray<unknown>) =>
      Option.match(Arr.head(rows), {
        onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
        onSome: (row) =>
          decodeOrderRow(row).pipe(Effect.flatMap(hydrateOrder), Effect.map(Option.some)),
      });

    const save = Effect.fn("DrizzleOrderRepository.save")(function* (order: CoffeeOrder) {
      const row = toOrderInsert(order);

      yield* db.insert(ordersTable).values(row).onConflictDoUpdate({
        target: ordersTable.id,
        set: row,
      });
      yield* db.delete(orderItemsTable).where(eq(orderItemsTable.orderId, order.id));
      yield* Effect.forEach(
        order.items.map((item, position) => toOrderItemInsert(order.id, item, position)),
        (item) => db.insert(orderItemsTable).values(item),
        { concurrency: 1, discard: true },
      );

      return order;
    });

    const getById = Effect.fnUntraced(function* (orderId: OrderId) {
      return yield* db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1)
        .pipe(Effect.flatMap(decodeOptionalOrder));
    });

    const list = Effect.fnUntraced(function* (filters: ListOrdersFilters = {}) {
      return yield* db
        .select()
        .from(ordersTable)
        .where(listWhere(filters))
        .orderBy(asc(ordersTable.createdAt), asc(ordersTable.id))
        .pipe(
          Effect.flatMap(decodeOrderRows),
          Effect.flatMap((orders) => Effect.forEach(orders, hydrateOrder, { concurrency: 1 })),
        );
    });

    return OrderRepository.of({
      save: (order) =>
        save(order).pipe(PersistenceError.refail(`Failed to save order "${order.id}"`)),
      getById: (orderId) =>
        getById(orderId).pipe(PersistenceError.refail(`Failed to load order "${orderId}"`)),
      list: (filters) =>
        list(filters).pipe(PersistenceError.refail("Failed to list coffee orders")),
    });
  }),
);
