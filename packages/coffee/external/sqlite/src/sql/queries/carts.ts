/**
 * Defines the SQL statements for carts and their items.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql";
import type { SqlCartItemSave } from "../models.ts";

export const deleteCartByOwner = Effect.fn("CoffeeSql.deleteCartByOwner")(function* (params: {
  readonly ownerUserId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    delete from carts
    where owner_user_id = ${params.ownerUserId}
  `;
});

export const deleteCartItemsByOwner = Effect.fn("CoffeeSql.deleteCartItemsByOwner")(
  function* (params: { readonly ownerUserId: string }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql`
    delete from cart_items
    where owner_user_id = ${params.ownerUserId}
  `;
  },
);

export const insertCart = Effect.fn("CoffeeSql.insertCart")(function* (params: {
  readonly ownerUserId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      carts (owner_user_id)
    values
      (${params.ownerUserId})
    on conflict (owner_user_id) do nothing
  `;
});

export const listCartItems = Effect.fn("CoffeeSql.listCartItems")(function* (params: {
  readonly ownerUserId: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      owner_user_id,
      id,
      position,
      drink_id,
      size,
      milk,
      temperature,
      shots,
      notes,
      quantity
    from cart_items
    where owner_user_id = ${params.ownerUserId}
    order by position
  `;
});

export const saveCartItem = Effect.fn("CoffeeSql.saveCartItem")(function* (params: {
  readonly item: SqlCartItemSave;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      cart_items (
        owner_user_id,
        id,
        position,
        drink_id,
        size,
        milk,
        temperature,
        shots,
        notes,
        quantity
      )
    values
      (
        ${params.item.ownerUserId},
        ${params.item.id},
        ${params.item.position},
        ${params.item.drinkId},
        ${params.item.size},
        ${params.item.milk},
        ${params.item.temperature},
        ${params.item.shots},
        ${params.item.notes},
        ${params.item.quantity}
      )
  `;
});
