/**
 * Defines the SQL statements for checkout sessions and their items.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql";
import type { SqlCheckoutSessionItemSave } from "../models.ts";

export const deleteCheckoutSessionItemsBySessionId = Effect.fn(
  "CoffeeSql.deleteCheckoutSessionItemsBySessionId",
)(function* (params: { readonly sessionId: string }) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    delete from checkout_session_items
    where session_id = ${params.sessionId}
  `;
});

export const deleteCurrentCheckoutSessionByOwner = Effect.fn(
  "CoffeeSql.deleteCurrentCheckoutSessionByOwner",
)(function* (params: { readonly ownerUserId: string }) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    delete from checkout_sessions
    where id = (
      select id
      from checkout_sessions
      where owner_user_id = ${params.ownerUserId}
        and status = 'awaiting_confirmation'
      order by updated_at desc, id desc
      limit 1
    )
  `;
});

export const findCheckoutSessionById = Effect.fn("CoffeeSql.findCheckoutSessionById")(
  function* (params: { readonly id: string }) {
    const sql = yield* SqlClient.SqlClient;
    const rows = yield* sql`
    select
      id,
      owner_user_id,
      status,
      total_price_cents,
      created_at,
      updated_at,
      expires_at
    from checkout_sessions
    where id = ${params.id}
  `;
    return Arr.head(rows);
  },
);

export const findCurrentCheckoutSessionByOwner = Effect.fn(
  "CoffeeSql.findCurrentCheckoutSessionByOwner",
)(function* (params: { readonly ownerUserId: string }) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    select
      id,
      owner_user_id,
      status,
      total_price_cents,
      created_at,
      updated_at,
      expires_at
    from checkout_sessions
    where owner_user_id = ${params.ownerUserId}
      and status = 'awaiting_confirmation'
    order by updated_at desc, id desc
    limit 1
  `;
  return Arr.head(rows);
});

export const listCheckoutSessionItems = Effect.fn("CoffeeSql.listCheckoutSessionItems")(
  function* (params: { readonly sessionId: string }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql`
    select
      session_id,
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
    from checkout_session_items
    where session_id = ${params.sessionId}
    order by position
  `;
  },
);

export const saveCheckoutSessionItem = Effect.fn("CoffeeSql.saveCheckoutSessionItem")(
  function* (params: { readonly item: SqlCheckoutSessionItemSave }) {
    const sql = yield* SqlClient.SqlClient;
    return yield* sql`
    insert into
      checkout_session_items (
        session_id,
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
        ${params.item.sessionId},
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
  },
);

export const saveCheckoutSession = Effect.fn("CoffeeSql.saveCheckoutSession")(function* (params: {
  readonly session: {
    readonly id: string;
    readonly ownerUserId: string;
    readonly status: string;
    readonly totalPriceCents: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly expiresAt: string;
  };
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      checkout_sessions (
        id,
        owner_user_id,
        status,
        total_price_cents,
        created_at,
        updated_at,
        expires_at
      )
    values
      (
        ${params.session.id},
        ${params.session.ownerUserId},
        ${params.session.status},
        ${params.session.totalPriceCents},
        ${params.session.createdAt},
        ${params.session.updatedAt},
        ${params.session.expiresAt}
      )
    on conflict (id) do update
    set
      owner_user_id = excluded.owner_user_id,
      status = excluded.status,
      total_price_cents = excluded.total_price_cents,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      expires_at = excluded.expires_at
  `;
});
