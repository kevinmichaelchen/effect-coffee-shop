import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from pending_order_confirmations
where owner_user_id = ?;
`.trim();
const query = (params: deletePendingOrderConfirmationByOwner.Params) => ({
  name: "deletePendingOrderConfirmationByOwner",
  sql,
  args: [params.param1],
});

export const deletePendingOrderConfirmationByOwner = Object.assign(
  function deletePendingOrderConfirmationByOwner(
    params: deletePendingOrderConfirmationByOwner.Params,
  ) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deletePendingOrderConfirmationByOwner {
  export type Params = {
    param1: string;
  };
}
