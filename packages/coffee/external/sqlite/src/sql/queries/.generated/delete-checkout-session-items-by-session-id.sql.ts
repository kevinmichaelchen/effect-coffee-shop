import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from checkout_session_items
where session_id = ?;
`.trim();
const query = (params: deleteCheckoutSessionItemsBySessionId.Params) => ({
  name: "deleteCheckoutSessionItemsBySessionId",
  sql,
  args: [params.sessionId],
});

export const deleteCheckoutSessionItemsBySessionId = Object.assign(
  function deleteCheckoutSessionItemsBySessionId(
    params: deleteCheckoutSessionItemsBySessionId.Params,
  ) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deleteCheckoutSessionItemsBySessionId {
  export type Params = {
    sessionId: string;
  };
}
