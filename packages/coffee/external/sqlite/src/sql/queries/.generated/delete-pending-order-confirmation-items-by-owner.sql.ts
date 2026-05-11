import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from pending_order_confirmation_items
where owner_user_id = ?;
`.trim();
const query = (params: deletePendingOrderConfirmationItemsByOwner.Params) => ({
  name: "deletePendingOrderConfirmationItemsByOwner",
  sql,
  args: [params.param1],
});

export const deletePendingOrderConfirmationItemsByOwner = Object.assign(
  function deletePendingOrderConfirmationItemsByOwner(
    params: deletePendingOrderConfirmationItemsByOwner.Params,
  ) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deletePendingOrderConfirmationItemsByOwner {
  export type Params = {
    param1: string;
  };
}
