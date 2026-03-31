import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient, SqlModel, SqlSchema, type SqlError } from "effect/unstable/sql";
import type * as Cause from "effect/Cause";
import {
  OrderStatusSchema,
  type CoffeeOrder,
  type ListOrdersFilters,
  type OrderId,
} from "#domain/order";
import { PersistenceError } from "#service/errors";
import { OrderRepository } from "#service/ports/OrderRepository";
import { SqlOrderModel, toCoffeeOrder, toSqlOrderInsert } from "./models.ts";

type SqlRepositoryError = Schema.SchemaError | SqlError.SqlError;
type SqlRepositoryMaybeMissingError = SqlRepositoryError | Cause.NoSuchElementError;

const ListOrdersFiltersSchema = Schema.Struct({
  status: Schema.optionalKey(OrderStatusSchema),
}).annotate({ identifier: "ListOrdersFilters" });

const makeSqlOrderQueries = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const repository = yield* SqlModel.makeRepository(SqlOrderModel, {
    tableName: "orders",
    spanPrefix: "SqlOrderRepository",
    idColumn: "id",
  });

  const findById = (
    orderId: OrderId,
  ): Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryMaybeMissingError> =>
    repository.findById(orderId);

  const insert = (
    order: typeof SqlOrderModel.insert.Type,
  ): Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryError> => repository.insert(order);

  const update = (
    order: typeof SqlOrderModel.update.Type,
  ): Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryError> => repository.update(order);

  const listRecords = (
    filters: ListOrdersFilters,
  ): Effect.Effect<ReadonlyArray<typeof SqlOrderModel.Type>, SqlRepositoryError> =>
    SqlSchema.findAll({
      Request: ListOrdersFiltersSchema,
      Result: SqlOrderModel,
      execute: (filters) =>
        filters.status === undefined
          ? sql`
          SELECT *
          FROM orders
          ORDER BY createdAt, id
        `
          : sql`
          SELECT *
          FROM orders
          WHERE status = ${filters.status}
          ORDER BY createdAt, id
        `,
    })(filters);

  const save = Effect.fn("SqlOrderRepository.save")(function* (
    order: CoffeeOrder,
  ): Effect.fn.Return<CoffeeOrder, SqlRepositoryError> {
    const record = toSqlOrderInsert(order);
    const saved = yield* findById(order.id).pipe(
      Effect.flatMap(() => update(record)),
      Effect.catchTag("NoSuchElementError", () => insert(record)),
    );
    return toCoffeeOrder(saved);
  });

  const getById = Effect.fn("SqlOrderRepository.getById")(function* (
    orderId: OrderId,
  ): Effect.fn.Return<Option.Option<CoffeeOrder>, SqlRepositoryError> {
    return yield* findById(orderId).pipe(
      Effect.map((order) => Option.some(toCoffeeOrder(order))),
      Effect.catchTag("NoSuchElementError", () => Effect.succeed(Option.none())),
    );
  });

  const list = Effect.fn("SqlOrderRepository.list")(function* (
    filters: ListOrdersFilters = {},
  ): Effect.fn.Return<ReadonlyArray<CoffeeOrder>, SqlRepositoryError> {
    const orders = yield* listRecords(filters);
    return orders.map(toCoffeeOrder);
  });

  return { save, getById, list } as const;
});

export const SqlOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlOrderQueries;

    return OrderRepository.of({
      save: (order) =>
        queries.save(order).pipe(PersistenceError.refail(`Failed to save order "${order.id}"`)),
      getById: (orderId) =>
        queries.getById(orderId).pipe(
          PersistenceError.refail(`Failed to load order "${orderId}"`),
        ),
      list: (filters) =>
        queries.list(filters).pipe(PersistenceError.refail("Failed to list coffee orders")),
    });
  }),
);
