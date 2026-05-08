import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  id,
  name,
  kind,
  base_price_cents,
  available_milks,
  available_temperatures,
  max_shots
from menu_items
order by sort_order, id;
`.trim();
const query = { name: "listMenuItems", sql, args: [] };

export const listMenuItems = Object.assign(
  function listMenuItems() {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query;
      const rows = yield* sqlClient.unsafe<listMenuItems.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listMenuItems {
  export type Result = {
    id: string;
    name: string;
    kind: string;
    base_price_cents: number;
    available_milks: string;
    available_temperatures: string;
    max_shots: number;
  };
}
