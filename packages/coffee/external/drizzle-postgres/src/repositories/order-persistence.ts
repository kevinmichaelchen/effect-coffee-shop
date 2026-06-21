/**
 * Loads and saves order rows with Drizzle/Postgres.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { and, asc, eq } from "drizzle-orm";
import type {
  CoffeeOrder,
  ListOrdersFilters,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { CoffeeDb } from "../db/Db.ts";
import {
  DrizzleOrderItemRowSchema,
  DrizzleOrderRowSchema,
  toCoffeeOrder,
  toOrderInsert,
  toOrderItemInsert,
} from "../db/models.ts";
import { orderItemsTable, ordersTable } from "../db/schema.ts";

type Db = CoffeeDb["Service"];
type DrizzleOrderRow = typeof DrizzleOrderRowSchema.Type;

const decodeOrderRow = Schema.decodeUnknownEffect(DrizzleOrderRowSchema);
const decodeOrderRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleOrderRowSchema));
const decodeOrderItemRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleOrderItemRowSchema));

const orderListWhere = (filters: ListOrdersFilters) =>
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

const loadOrderItems = (db: Db, orderId: OrderId) =>
  db
    .select()
    .from(orderItemsTable)
    .where(eq(orderItemsTable.orderId, orderId))
    .orderBy(asc(orderItemsTable.position))
    .pipe(Effect.flatMap(decodeOrderItemRows));

const hydrateOrder = (db: Db, order: DrizzleOrderRow) =>
  loadOrderItems(db, order.id).pipe(Effect.map((items) => toCoffeeOrder(order, items)));

const decodeOptionalOrder = (db: Db, rows: ReadonlyArray<unknown>) =>
  Option.match(Arr.head(rows), {
    onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
    onSome: (row) =>
      decodeOrderRow(row).pipe(
        Effect.flatMap((order) => hydrateOrder(db, order)),
        Effect.map(Option.some),
      ),
  });

export const saveOrder = (db: Db, order: CoffeeOrder) =>
  Effect.gen(function* () {
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

export const loadOrderById = (db: Db, orderId: OrderId) =>
  db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1)
    .pipe(Effect.flatMap((rows) => decodeOptionalOrder(db, rows)));

export const listOrders = (db: Db, filters: ListOrdersFilters = {}) =>
  db
    .select()
    .from(ordersTable)
    .where(orderListWhere(filters))
    .orderBy(asc(ordersTable.createdAt), asc(ordersTable.id))
    .pipe(
      Effect.flatMap(decodeOrderRows),
      Effect.flatMap((orders) =>
        Effect.forEach(orders, (order) => hydrateOrder(db, order), { concurrency: 1 }),
      ),
    );
