import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  pending_order_confirmations (owner_user_id, source, total_price_cents, updated_at)
values
  (?, ?, ?, ?)
on conflict (owner_user_id) do update set
  source = excluded.source,
  total_price_cents = excluded.total_price_cents,
  updated_at = excluded.updated_at;
`.trim();
const query = (params: savePendingOrderConfirmation.Params) => ({
  name: "savePendingOrderConfirmation",
  sql,
  args: [params.param1, params.param2, params.param3, params.param4],
});

export const savePendingOrderConfirmation = Object.assign(
  function savePendingOrderConfirmation(params: savePendingOrderConfirmation.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace savePendingOrderConfirmation {
  export type Params = {
    param1: string;
    param2: string;
    param3: number;
    param4: string;
  };
}
