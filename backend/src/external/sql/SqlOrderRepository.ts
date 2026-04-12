import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient, SqlModel, SqlSchema, type SqlError } from "effect/unstable/sql";
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

const ListOrdersFiltersSchema = Schema.Struct({
  ownerUserId: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(OrderStatusSchema),
}).annotate({ identifier: "ListOrdersFilters" });

const makeSqlOrderQueries = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const repository = yield* SqlModel.makeRepository(SqlOrderModel, {
    tableName: "orders",
    spanPrefix: "SqlOrderRepository",
    idColumn: "id",
  });

  const findById = (orderId: OrderId) => repository.findById(orderId);

  const insert = (order: typeof SqlOrderModel.insert.Type) => repository.insert(order);

  const update = (order: typeof SqlOrderModel.update.Type) => repository.update(order);

  const buildListWhereClauses = (filters: ListOrdersFilters) =>
    Arr.getSomes([
      Option.map(
        Option.fromUndefinedOr(filters.ownerUserId),
        (ownerUserId) => sql`ownerUserId = ${ownerUserId}`,
      ),
      Option.map(Option.fromUndefinedOr(filters.status), (status) => sql`status = ${status}`),
    ]);

  const listRecords = (filters: ListOrdersFilters) =>
    SqlSchema.findAll({
      Request: ListOrdersFiltersSchema,
      Result: SqlOrderModel,
      execute: (filters) => {
        const whereClauses = buildListWhereClauses(filters);

        return Option.match(Arr.head(whereClauses), {
          onNone: () => sql`
          SELECT *
          FROM orders
          ORDER BY createdAt, id
        `,
          onSome: () => sql`
          SELECT *
          FROM orders
          WHERE ${sql.and(whereClauses)}
          ORDER BY createdAt, id
        `,
        });
      },
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
        queries.getById(orderId).pipe(PersistenceError.refail(`Failed to load order "${orderId}"`)),
      list: (filters) =>
        queries.list(filters).pipe(PersistenceError.refail("Failed to list coffee orders")),
    });
  }),
);
