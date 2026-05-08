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
where id = ?
limit 1;
`.trim();
const query = (params: findMenuItemById.Params) => ({
  name: "findMenuItemById",
  sql,
  args: [params.id],
});

export const findMenuItemById = Object.assign(
  function findMenuItemById(params: findMenuItemById.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findMenuItemById.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows.length > 0 ? rows[0] : null;
    });
  },
  { sql, query },
);

export namespace findMenuItemById {
  export type Params = {
    id: string;
  };
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
