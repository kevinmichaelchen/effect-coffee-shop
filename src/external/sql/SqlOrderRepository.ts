import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { SqlClient, SqlModel, SqlSchema, type SqlError } from "effect/unstable/sql";
import type * as Cause from "effect/Cause";
import {
  OrderStatusSchema,
  type CoffeeOrder,
  type ListOrdersFilters,
  type OrderId,
} from "../../domain/order.ts";
import { OrderRepository } from "../../service/ports/OrderRepository.ts";
import { SqlOrderModel, toCoffeeOrder, toSqlOrderInsert } from "./models.ts";

type SqlRepositoryError = Schema.SchemaError | SqlError.SqlError;
type SqlRepositoryMaybeMissingError = SqlRepositoryError | Cause.NoSuchElementError;
type SqlOrderQueries = {
  readonly findById: (
    orderId: OrderId,
  ) => Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryMaybeMissingError>;
  readonly insert: (
    order: typeof SqlOrderModel.insert.Type,
  ) => Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryError>;
  readonly update: (
    order: typeof SqlOrderModel.update.Type,
  ) => Effect.Effect<typeof SqlOrderModel.Type, SqlRepositoryError>;
  readonly list: (
    filters: ListOrdersFilters,
  ) => Effect.Effect<ReadonlyArray<typeof SqlOrderModel.Type>, SqlRepositoryError>;
};

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

  const queries: SqlOrderQueries = {
    findById: repository.findById as SqlOrderQueries["findById"],
    insert: repository.insert as SqlOrderQueries["insert"],
    update: repository.update as SqlOrderQueries["update"],
    list: SqlSchema.findAll({
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
    }) as SqlOrderQueries["list"],
  };

  const save = Effect.fn("SqlOrderRepository.save")(function* (
    order: CoffeeOrder,
  ): Effect.fn.Return<CoffeeOrder, SqlRepositoryError> {
    const record = toSqlOrderInsert(order);
    const saved = yield* queries.findById(order.id).pipe(
      Effect.flatMap(() => queries.update(record)),
      Effect.catchTag("NoSuchElementError", () => queries.insert(record)),
    );
    return toCoffeeOrder(saved);
  });

  const getById = Effect.fn("SqlOrderRepository.getById")(function* (
    orderId: OrderId,
  ): Effect.fn.Return<CoffeeOrder | undefined, SqlRepositoryError> {
    return yield* queries.findById(orderId).pipe(
      Effect.map(toCoffeeOrder),
      Effect.catchTag("NoSuchElementError", () => Effect.succeed(undefined)),
    );
  });

  const list = Effect.fn("SqlOrderRepository.list")(function* (
    filters: ListOrdersFilters = {},
  ): Effect.fn.Return<ReadonlyArray<CoffeeOrder>, SqlRepositoryError> {
    const orders = yield* queries.list(filters);
    return orders.map(toCoffeeOrder);
  });

  return { save, getById, list } as const;
});

export const SqlOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlOrderQueries;

    return OrderRepository.of({
      save: (order) => queries.save(order).pipe(Effect.orDie),
      getById: (orderId) => queries.getById(orderId).pipe(Effect.orDie),
      list: (filters) => queries.list(filters).pipe(Effect.orDie),
    });
  }),
);
