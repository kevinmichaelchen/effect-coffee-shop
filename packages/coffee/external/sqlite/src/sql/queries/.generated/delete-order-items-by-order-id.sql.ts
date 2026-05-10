import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from order_items
where order_id = ?;
`.trim();
const query = (params: deleteOrderItemsByOrderId.Params) => ({
  name: "deleteOrderItemsByOrderId",
  sql,
  args: [params.order_id],
});

export const deleteOrderItemsByOrderId = Object.assign(
  function deleteOrderItemsByOrderId(params: deleteOrderItemsByOrderId.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deleteOrderItemsByOrderId {
  export type Params = {
    order_id: string;
  };
}
