import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { CoffeeOrder, ListOrdersFilters, OrderId } from "#domain/order";
import { PersistenceError } from "#service/errors";
import { OrderRepository } from "#service/ports/OrderRepository";
import { findOrderById } from "./queries/.generated/find-order-by-id.sql.ts";
import { listOrders } from "./queries/.generated/list-orders.sql.ts";
import { listOrdersByOwnerAndStatus } from "./queries/.generated/list-orders-by-owner-and-status.sql.ts";
import { listOrdersByOwner } from "./queries/.generated/list-orders-by-owner.sql.ts";
import { listOrdersByStatus } from "./queries/.generated/list-orders-by-status.sql.ts";
import { saveOrder } from "./queries/.generated/save-order.sql.ts";
import { SqlOrderModel, toCoffeeOrder, toSqlOrderSave } from "./models.ts";

const decodeSqlOrder = Schema.decodeUnknownEffect(SqlOrderModel);
const decodeSqlOrders = Schema.decodeUnknownEffect(Schema.Array(SqlOrderModel));

const decodeOptionalSqlOrder = (row: unknown) =>
  Option.match(Option.fromNullishOr(row), {
    onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
    onSome: (row) => decodeSqlOrder(row).pipe(Effect.map(toCoffeeOrder), Effect.map(Option.some)),
  });

const listRecords = (filters: ListOrdersFilters) =>
  Option.match(Option.fromUndefinedOr(filters.ownerUserId), {
    onNone: () =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () => listOrders(),
        onSome: (status) => listOrdersByStatus({ status }),
      }),
    onSome: (ownerUserId) =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () => listOrdersByOwner({ owner_user_id: ownerUserId }),
        onSome: (status) => listOrdersByOwnerAndStatus({ owner_user_id: ownerUserId, status }),
      }),
  });

const makeSqlOrderQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlOrderRepository.save")(function* (order: CoffeeOrder) {
    const saved = yield* Effect.provideService(
      saveOrder({ order: toSqlOrderSave(order) }).pipe(Effect.flatMap(decodeSqlOrder)),
      SqlClient.SqlClient,
      sqlClient,
    );
    return toCoffeeOrder(saved);
  });

  const getById = Effect.fn("SqlOrderRepository.getById")(function* (orderId: OrderId) {
    return yield* Effect.provideService(
      findOrderById({ id: orderId }).pipe(Effect.flatMap(decodeOptionalSqlOrder)),
      SqlClient.SqlClient,
      sqlClient,
    );
  });

  const list = Effect.fn("SqlOrderRepository.list")(function* (filters: ListOrdersFilters = {}) {
    const orders = yield* Effect.provideService(
      listRecords(filters).pipe(Effect.flatMap(decodeSqlOrders)),
      SqlClient.SqlClient,
      sqlClient,
    );
    return orders.map(toCoffeeOrder);
  });

  return { getById, list, save } as const;
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
