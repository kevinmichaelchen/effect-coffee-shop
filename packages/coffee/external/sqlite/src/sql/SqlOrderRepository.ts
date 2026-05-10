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

const decodeSqlOrder = Schema.decodeUnknownEffect(SqlOrderModel);
const decodeSqlOrders = Schema.decodeUnknownEffect(Schema.Array(SqlOrderModel));
const decodeSqlOrderItems = Schema.decodeUnknownEffect(Schema.Array(SqlOrderItemModel));

const insertOrderSql = `
insert into orders (id, customer_name, owner_user_id, status, total_price_cents, created_at)
values (?, ?, ?, ?, ?, ?)
on conflict (id) do update set
  customer_name = excluded.customer_name,
  owner_user_id = excluded.owner_user_id,
  status = excluded.status,
  total_price_cents = excluded.total_price_cents,
  created_at = excluded.created_at
`.trim();

const insertOrderItemSql = `
insert into order_items (
  order_id,
  position,
  drink_id,
  drink_name,
  size,
  milk,
  temperature,
  shots,
  notes,
  quantity,
  unit_price_cents,
  line_total_cents
)
values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`.trim();

const findOrderSql = `
select id, customer_name, owner_user_id, status, total_price_cents, created_at
from orders
where id = ?
limit 1
`.trim();

const listOrdersSql = `
select id, customer_name, owner_user_id, status, total_price_cents, created_at
from orders
order by created_at, id
`.trim();

const listOrdersByStatusSql = `
select id, customer_name, owner_user_id, status, total_price_cents, created_at
from orders
where status = ?
order by created_at, id
`.trim();

const listOrdersByOwnerSql = `
select id, customer_name, owner_user_id, status, total_price_cents, created_at
from orders
where owner_user_id = ?
order by created_at, id
`.trim();

const listOrdersByOwnerAndStatusSql = `
select id, customer_name, owner_user_id, status, total_price_cents, created_at
from orders
where owner_user_id = ? and status = ?
order by created_at, id
`.trim();

const listOrderItemsSql = `
select
  order_id,
  position,
  drink_id,
  drink_name,
  size,
  milk,
  temperature,
  shots,
  notes,
  quantity,
  unit_price_cents,
  line_total_cents
from order_items
where order_id = ?
order by position
`.trim();

const listRecords = (sqlClient: SqlClient.SqlClient, filters: ListOrdersFilters) =>
  Option.match(Option.fromUndefinedOr(filters.ownerUserId), {
    onNone: () =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () => sqlClient.unsafe<Record<string, unknown>>(listOrdersSql),
        onSome: (status) =>
          sqlClient.unsafe<Record<string, unknown>>(listOrdersByStatusSql, [status]),
      }),
    onSome: (ownerUserId) =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () =>
          sqlClient.unsafe<Record<string, unknown>>(listOrdersByOwnerSql, [ownerUserId]),
        onSome: (status) =>
          sqlClient.unsafe<Record<string, unknown>>(listOrdersByOwnerAndStatusSql, [
            ownerUserId,
            status,
          ]),
      }),
  });

const loadItems = (sqlClient: SqlClient.SqlClient, orderId: OrderId) =>
  sqlClient
    .unsafe<Record<string, unknown>>(listOrderItemsSql, [orderId])
    .pipe(Effect.flatMap(decodeSqlOrderItems));

const hydrateOrder = Effect.fnUntraced(function* (
  sqlClient: SqlClient.SqlClient,
  order: typeof SqlOrderModel.Type,
) {
  const items = yield* loadItems(sqlClient, order.id);
  return toCoffeeOrder(order, items);
});

const makeSqlOrderQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlOrderRepository.save")(function* (order: CoffeeOrder) {
    const record = toSqlOrderSave(order);

    yield* sqlClient.unsafe(insertOrderSql, [
      record.id,
      record.customer_name,
      record.owner_user_id,
      record.status,
      record.total_price_cents,
      record.created_at,
    ]);
    yield* sqlClient.unsafe("delete from order_items where order_id = ?", [order.id]);
    yield* Effect.forEach(
      order.items.map((item, position) => toSqlOrderItemSave(order.id, item, position)),
      (item) =>
        sqlClient.unsafe(insertOrderItemSql, [
          item.order_id,
          item.position,
          item.drink_id,
          item.drink_name,
          item.size,
          item.milk,
          item.temperature,
          item.shots,
          item.notes,
          item.quantity,
          item.unit_price_cents,
          item.line_total_cents,
        ]),
      { discard: true },
    );

    return order;
  });

  const getById = Effect.fn("SqlOrderRepository.getById")(function* (orderId: OrderId) {
    const rows = yield* sqlClient.unsafe<Record<string, unknown>>(findOrderSql, [orderId]);
    return yield* Option.match(Option.fromUndefinedOr(rows[0]), {
      onNone: () => Effect.succeed(Option.none<CoffeeOrder>()),
      onSome: (row) =>
        decodeSqlOrder(row).pipe(
          Effect.flatMap((order) => hydrateOrder(sqlClient, order)),
          Effect.map(Option.some),
        ),
    });
  });

  const list = Effect.fn("SqlOrderRepository.list")(function* (filters: ListOrdersFilters = {}) {
    const rows = yield* listRecords(sqlClient, filters).pipe(Effect.flatMap(decodeSqlOrders));
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
