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
import { DrizzleOrderRowSchema, toCoffeeOrder, toOrderInsert } from "../db/models.ts";
import { ordersTable } from "../db/schema.ts";

const decodeOrderRow = Schema.decodeUnknownEffect(DrizzleOrderRowSchema);
const decodeOrderRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleOrderRowSchema));

const decodeSavedOrder = (rows: ReadonlyArray<unknown>) =>
  Effect.gen(function* () {
    const row = yield* Option.match(Arr.head(rows), {
      onNone: () => Effect.die("DrizzleOrderRepository.save returned no rows"),
      onSome: Effect.succeed,
    });
    const decoded = yield* decodeOrderRow(row);
    return toCoffeeOrder(decoded);
  });

const decodeOptionalOrder = (rows: ReadonlyArray<unknown>) =>
  Option.match(Arr.head(rows), {
    onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
    onSome: (row) => decodeOrderRow(row).pipe(Effect.map(toCoffeeOrder), Effect.map(Option.some)),
  });

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

    const save = (order: CoffeeOrder) => {
      const row = toOrderInsert(order);

      return db
        .insert(ordersTable)
        .values(row)
        .onConflictDoUpdate({
          target: ordersTable.id,
          set: row,
        })
        .returning()
        .pipe(Effect.flatMap(decodeSavedOrder));
    };

    const getById = (orderId: OrderId) =>
      db
        .select()
        .from(ordersTable)
        .where(eq(ordersTable.id, orderId))
        .limit(1)
        .pipe(Effect.flatMap(decodeOptionalOrder));

    const list = (filters: ListOrdersFilters = {}) =>
      db
        .select()
        .from(ordersTable)
        .where(listWhere(filters))
        .orderBy(asc(ordersTable.createdAt), asc(ordersTable.id))
        .pipe(
          Effect.flatMap(decodeOrderRows),
          Effect.map((orders) => orders.map(toCoffeeOrder)),
        );

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
