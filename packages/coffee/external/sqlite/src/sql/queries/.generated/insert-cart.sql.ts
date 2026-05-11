import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  carts (owner_user_id)
values
  (?)
on conflict (owner_user_id) do nothing;
`.trim();
const query = (params: insertCart.Params) => ({
  name: "insertCart",
  sql,
  args: [params.ownerUserId],
});

export const insertCart = Object.assign(
  function insertCart(params: insertCart.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace insertCart {
  export type Params = {
    ownerUserId: string;
  };
}
