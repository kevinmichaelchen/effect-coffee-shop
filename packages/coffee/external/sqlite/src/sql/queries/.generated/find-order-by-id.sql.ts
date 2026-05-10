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
left join order_items on order_items.order_id = orders.id
where orders.id = ?
order by orders.created_at, orders.id;
`.trim();
const query = (params: findOrderById.Params) => ({ name: "findOrderById", sql, args: [params.id] });

export const findOrderById = Object.assign(
  function findOrderById(params: findOrderById.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findOrderById.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace findOrderById {
  export type Params = {
    id: string;
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
