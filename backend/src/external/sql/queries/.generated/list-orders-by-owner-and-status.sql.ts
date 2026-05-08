import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select *
from orders
where owner_user_id = ? and status = ?
order by created_at, id;
`.trim();
const query = (params: listOrdersByOwnerAndStatus.Params) => ({
  name: "listOrdersByOwnerAndStatus",
  sql,
  args: [params.owner_user_id, params.status],
});

export const listOrdersByOwnerAndStatus = Object.assign(
  function listOrdersByOwnerAndStatus(params: listOrdersByOwnerAndStatus.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listOrdersByOwnerAndStatus.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrdersByOwnerAndStatus {
  export type Params = {
    owner_user_id: string;
    status: string;
  };
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
