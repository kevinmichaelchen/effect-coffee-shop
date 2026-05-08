import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select *
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
    drink_id: string;
    drink_name: string;
    size: string;
    milk: string;
    temperature: string;
    shots: number;
    notes?: string;
    status: string;
    price_cents: number;
    created_at: string;
  };
}
