/**
 * Defines the SQL statements for the static Coffee menu.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import { SqlClient } from "effect/sql";
import type { SqlMenuItemSeed } from "../models.ts";

export const findMenuItemById = Effect.fn("CoffeeSql.findMenuItemById")(function* (params: {
  readonly id: string;
}) {
  const sql = yield* SqlClient.SqlClient;
  const rows = yield* sql`
    select
      id,
      name,
      kind,
      base_price_cents,
      available_milks,
      available_temperatures,
      max_shots
    from menu_items
    where id = ${params.id}
    limit 1
  `;
  return Arr.head(rows);
});

export const listMenuItems = Effect.fn("CoffeeSql.listMenuItems")(function* () {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    select
      id,
      name,
      kind,
      base_price_cents,
      available_milks,
      available_temperatures,
      max_shots
    from menu_items
    order by sort_order, id
  `;
});

export const seedMenuItem = Effect.fn("CoffeeSql.seedMenuItem")(function* (params: {
  readonly item: SqlMenuItemSeed;
}) {
  const sql = yield* SqlClient.SqlClient;
  return yield* sql`
    insert into
      menu_items (
        id,
        name,
        kind,
        sort_order,
        base_price_cents,
        available_milks,
        available_temperatures,
        max_shots
      )
    values
      (
        ${params.item.id},
        ${params.item.name},
        ${params.item.kind},
        ${params.item.sortOrder},
        ${params.item.basePriceCents},
        ${params.item.availableMilks},
        ${params.item.availableTemperatures},
        ${params.item.maxShots}
      )
    on conflict (id) do update
    set
      name = excluded.name,
      kind = excluded.kind,
      sort_order = excluded.sort_order,
      base_price_cents = excluded.base_price_cents,
      available_milks = excluded.available_milks,
      available_temperatures = excluded.available_temperatures,
      max_shots = excluded.max_shots
  `;
});
