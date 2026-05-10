import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from carts
where owner_user_id = ?;
`.trim();
const query = (params: deleteCartByOwner.Params) => ({
  name: "deleteCartByOwner",
  sql,
  args: [params.ownerUserId],
});

export const deleteCartByOwner = Object.assign(
  function deleteCartByOwner(params: deleteCartByOwner.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deleteCartByOwner {
  export type Params = {
    ownerUserId: string;
  };
}
