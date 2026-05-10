import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
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
where owner_user_id = ?
order by position;
`.trim();
const query = (params: listCartItems.Params) => ({
  name: "listCartItems",
  sql,
  args: [params.owner_user_id],
});

export const listCartItems = Object.assign(
  function listCartItems(params: listCartItems.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listCartItems.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listCartItems {
  export type Params = {
    owner_user_id: string;
  };
  export type Result = {
    owner_user_id: string;
    id: string;
    position: number;
    drink_id: string;
    size: string;
    milk: string;
    temperature: string;
    shots: number;
    notes?: string;
    quantity: number;
  };
}
