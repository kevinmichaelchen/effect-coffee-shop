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
order by created_at, id;
`.trim();
const query = { name: "listOrders", sql, args: [] };

export const listOrders = Object.assign(
  function listOrders() {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query;
      const rows = yield* sqlClient.unsafe<listOrders.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrders {
  export type Result = {
    id: string;
    customer_name: string;
    owner_user_id: string;
    status: string;
    total_price_cents: number;
    created_at: string;
  };
}
