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
where owner_user_id = ? and status = ?
order by created_at, id;
`.trim();
const query = (params: listOrdersByOwnerAndStatus.Params) => ({
  name: "listOrdersByOwnerAndStatus",
  sql,
  args: [params.ownerUserId, params.status],
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
    ownerUserId: string;
    status: string;
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
