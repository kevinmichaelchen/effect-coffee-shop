import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  owner_user_id,
  confirmation_id,
  source,
  total_price_cents,
  updated_at
from pending_order_confirmations
where owner_user_id = ?;
`.trim();
const query = (params: findPendingOrderConfirmation.Params) => ({
  name: "findPendingOrderConfirmation",
  sql,
  args: [params.param1],
});

export const findPendingOrderConfirmation = Object.assign(
  function findPendingOrderConfirmation(params: findPendingOrderConfirmation.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findPendingOrderConfirmation.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows.length > 0 ? rows[0] : null;
    });
  },
  { sql, query },
);

export namespace findPendingOrderConfirmation {
  export type Params = {
    param1: string;
  };
  export type Result = {
    owner_user_id: string;
    confirmation_id: string;
    source: string;
    total_price_cents: number;
    updated_at: string;
  };
}
