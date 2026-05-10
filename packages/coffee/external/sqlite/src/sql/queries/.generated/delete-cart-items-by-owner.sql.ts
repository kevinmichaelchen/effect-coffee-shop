import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from cart_items
where owner_user_id = ?;
`.trim();
const query = (params: deleteCartItemsByOwner.Params) => ({
  name: "deleteCartItemsByOwner",
  sql,
  args: [params.ownerUserId],
});

export const deleteCartItemsByOwner = Object.assign(
  function deleteCartItemsByOwner(params: deleteCartItemsByOwner.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deleteCartItemsByOwner {
  export type Params = {
    ownerUserId: string;
  };
}
