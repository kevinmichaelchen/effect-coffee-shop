import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  id,
  name,
  kind,
  basepricecents,
  availablemilks,
  availabletemperatures,
  maxshots
from menu_items
order by sortorder, id;
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
    basepricecents: number;
    availablemilks: string;
    availabletemperatures: string;
    maxshots: number;
  };
}
