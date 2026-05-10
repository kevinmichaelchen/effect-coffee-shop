import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  id,
  customer_name,
  owner_user_id,
  status,
  total_price_cents,
  created_at
from orders
where owner_user_id = ?
order by created_at, id;
`.trim();
const query = (params: listOrdersByOwner.Params) => ({
  name: "listOrdersByOwner",
  sql,
  args: [params.owner_user_id],
});

export const listOrdersByOwner = Object.assign(
  function listOrdersByOwner(params: listOrdersByOwner.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listOrdersByOwner.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrdersByOwner {
  export type Params = {
    owner_user_id: string;
  };
  export type Result = {
    id: string;
    customer_name: string;
    owner_user_id: string;
    status: string;
    total_price_cents: number;
    created_at: string;
  };
}
