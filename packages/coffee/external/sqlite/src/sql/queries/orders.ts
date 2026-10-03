/**
 * Defines the SQL statements for orders and their items.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql";
import type { SqlOrderItemSave, SqlOrderSave } from "../models.ts";

export const deleteOrderItemsByOrderId = Effect.fn("CoffeeSql.deleteOrderItemsByOrderId")(
  function* (params: { readonly orderId: string }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql`
    delete from order_items
    where order_id = ${params.orderId}
  `;
  },
);

export const findOrderById = Effect.fn("CoffeeSql.findOrderById")(function* (params: {
  readonly id: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      id,
      customer_name,
      owner_user_id,
      status,
      total_price_cents,
      created_at
    from orders
    left join order_items on order_items.order_id = orders.id
    where orders.id = ${params.id}
    order by orders.created_at, orders.id
  `;
});

export const listOrderItems = Effect.fn("CoffeeSql.listOrderItems")(function* (params: {
  readonly orderId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
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
    where order_id = ${params.orderId}
    order by position
  `;
});

export const listOrdersByOwnerAndStatus = Effect.fn("CoffeeSql.listOrdersByOwnerAndStatus")(
  function* (params: { readonly ownerUserId: string; readonly status: string }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql`
    select
      id,
      customer_name,
      owner_user_id,
      status,
      total_price_cents,
      created_at
    from orders
    where owner_user_id = ${params.ownerUserId} and status = ${params.status}
    order by created_at, id
  `;
  },
);

export const listOrdersByOwner = Effect.fn("CoffeeSql.listOrdersByOwner")(function* (params: {
  readonly ownerUserId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      id,
      customer_name,
      owner_user_id,
      status,
      total_price_cents,
      created_at
    from orders
    where owner_user_id = ${params.ownerUserId}
    order by created_at, id
  `;
});

export const listOrdersByStatus = Effect.fn("CoffeeSql.listOrdersByStatus")(function* (params: {
  readonly status: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      id,
      customer_name,
      owner_user_id,
      status,
      total_price_cents,
      created_at
    from orders
    where status = ${params.status}
    order by created_at, id
  `;
});

export const listOrders = Effect.fn("CoffeeSql.listOrders")(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      id,
      customer_name,
      owner_user_id,
      status,
      total_price_cents,
      created_at
    from orders
    order by created_at, id
  `;
});

export const saveOrderItem = Effect.fn("CoffeeSql.saveOrderItem")(function* (params: {
  readonly item: SqlOrderItemSave;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      order_items (
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
    values
      (
        ${params.item.orderId},
        ${params.item.position},
        ${params.item.drinkId},
        ${params.item.drinkName},
        ${params.item.size},
        ${params.item.milk},
        ${params.item.temperature},
        ${params.item.shots},
        ${params.item.notes},
        ${params.item.quantity},
        ${params.item.unitPriceCents},
        ${params.item.lineTotalCents}
      )
  `;
});

export const saveOrder = Effect.fn("CoffeeSql.saveOrder")(function* (params: {
  readonly order: SqlOrderSave;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      orders (id, customer_name, owner_user_id, status, total_price_cents, created_at)
    values
      (
        ${params.order.id},
        ${params.order.customerName},
        ${params.order.ownerUserId},
        ${params.order.status},
        ${params.order.totalPriceCents},
        ${params.order.createdAt}
      )
    on conflict (id) do update
    set
      customer_name = excluded.customer_name,
      owner_user_id = excluded.owner_user_id,
      status = excluded.status,
      total_price_cents = excluded.total_price_cents,
      created_at = excluded.created_at
  `;
});
