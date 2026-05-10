import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type {
  CoffeeOrder,
  ListOrdersFilters,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import {
  SqlOrderItemModel,
  SqlOrderModel,
  toCoffeeOrder,
  toSqlOrderItemSave,
  toSqlOrderSave,
} from "./models.ts";
import { deleteOrderItemsByOrderId } from "./queries/.generated/delete-order-items-by-order-id.sql.ts";
import { findOrderById } from "./queries/.generated/find-order-by-id.sql.ts";
import { listOrderItems } from "./queries/.generated/list-order-items.sql.ts";
import { listOrders } from "./queries/.generated/list-orders.sql.ts";
import { listOrdersByOwner } from "./queries/.generated/list-orders-by-owner.sql.ts";
import { listOrdersByOwnerAndStatus } from "./queries/.generated/list-orders-by-owner-and-status.sql.ts";
import { listOrdersByStatus } from "./queries/.generated/list-orders-by-status.sql.ts";
import { saveOrder } from "./queries/.generated/save-order.sql.ts";
import { saveOrderItem } from "./queries/.generated/save-order-item.sql.ts";

const decodeSqlOrders = Schema.decodeUnknownEffect(Schema.Array(SqlOrderModel));
const decodeSqlOrderItems = Schema.decodeUnknownEffect(Schema.Array(SqlOrderItemModel));

const hydrateOrder = Effect.fnUntraced(function* (
  sqlClient: SqlClient.SqlClient,
  order: typeof SqlOrderModel.Type,
) {
  const items = yield* listOrderItems({ order_id: order.id }).pipe(
    Effect.provideService(SqlClient.SqlClient, sqlClient),
    Effect.flatMap(decodeSqlOrderItems),
  );
  return toCoffeeOrder(order, items);
});

const makeSqlOrderQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlOrderRepository.save")(function* (order: CoffeeOrder) {
    const record = toSqlOrderSave(order);

    yield* saveOrder({ order: record }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient));
    yield* deleteOrderItemsByOrderId({ order_id: order.id }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* Effect.forEach(
      order.items.map((item, position) => toSqlOrderItemSave(order.id, item, position)),
      (item) => saveOrderItem({ item }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient)),
      { discard: true },
    );

    return order;
  });

  const getById = Effect.fn("SqlOrderRepository.getById")(function* (orderId: OrderId) {
    const rows = yield* findOrderById({ id: orderId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
      Effect.flatMap(decodeSqlOrders),
    );
    return yield* Option.match(Option.fromUndefinedOr(rows[0]), {
      onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
      onSome: (order) => hydrateOrder(sqlClient, order).pipe(Effect.map(Option.some)),
    });
  });

  const list = Effect.fn("SqlOrderRepository.list")(function* (filters: ListOrdersFilters = {}) {
    const rows = yield* Option.match(Option.fromUndefinedOr(filters.ownerUserId), {
      onNone: () =>
        Option.match(Option.fromUndefinedOr(filters.status), {
          onNone: () => listOrders(),
          onSome: (status) => listOrdersByStatus({ status }),
        }),
      onSome: (ownerUserId) =>
        Option.match(Option.fromUndefinedOr(filters.status), {
          onNone: () => listOrdersByOwner({ owner_user_id: ownerUserId }),
          onSome: (status) =>
            listOrdersByOwnerAndStatus({
              owner_user_id: ownerUserId,
              status,
            }),
        }),
    }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient), Effect.flatMap(decodeSqlOrders));
    return yield* Effect.forEach(rows, (row) => hydrateOrder(sqlClient, row));
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
