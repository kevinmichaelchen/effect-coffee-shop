import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
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
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
on conflict (id) do update
set
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  base_price_cents = excluded.base_price_cents,
  available_milks = excluded.available_milks,
  available_temperatures = excluded.available_temperatures,
  max_shots = excluded.max_shots;
`.trim();
const query = (params: seedMenuItem.Params) => ({
  name: "seedMenuItem",
  sql,
  args: [
    params.item.id,
    params.item.name,
    params.item.kind,
    params.item.sortOrder,
    params.item.basePriceCents,
    params.item.availableMilks,
    params.item.availableTemperatures,
    params.item.maxShots,
  ],
});

export const seedMenuItem = Object.assign(
  function seedMenuItem(params: seedMenuItem.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace seedMenuItem {
  export type Params = {
    item: {
      id: string;
      name: string;
      kind: string;
      sortOrder: number;
      basePriceCents: number;
      availableMilks: string;
      availableTemperatures: string;
      maxShots: number;
    };
  };
}
