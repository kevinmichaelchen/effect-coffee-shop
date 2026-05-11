import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
delete from checkout_sessions
where id = (
  select id
  from checkout_sessions
  where owner_user_id = ?
    and status = 'awaiting_confirmation'
  order by updated_at desc, id desc
  limit 1
);
`.trim();
const query = (params: deleteCurrentCheckoutSessionByOwner.Params) => ({
  name: "deleteCurrentCheckoutSessionByOwner",
  sql,
  args: [params.ownerUserId],
});

export const deleteCurrentCheckoutSessionByOwner = Object.assign(
  function deleteCurrentCheckoutSessionByOwner(params: deleteCurrentCheckoutSessionByOwner.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace deleteCurrentCheckoutSessionByOwner {
  export type Params = {
    ownerUserId: string;
  };
}
