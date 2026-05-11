import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  id,
  owner_user_id,
  status,
  total_price_cents,
  created_at,
  updated_at,
  expires_at
from checkout_sessions
where owner_user_id = ?
  and status = 'awaiting_confirmation'
order by updated_at desc, id desc
limit 1;
`.trim();
const query = (params: findCurrentCheckoutSessionByOwner.Params) => ({
  name: "findCurrentCheckoutSessionByOwner",
  sql,
  args: [params.ownerUserId],
});

export const findCurrentCheckoutSessionByOwner = Object.assign(
  function findCurrentCheckoutSessionByOwner(params: findCurrentCheckoutSessionByOwner.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findCurrentCheckoutSessionByOwner.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows.length > 0 ? rows[0] : null;
    });
  },
  { sql, query },
);

export namespace findCurrentCheckoutSessionByOwner {
  export type Params = {
    ownerUserId: string;
  };
  export type Result = {
    id: string;
    owner_user_id: string;
    status: string;
    total_price_cents: number;
    created_at: string;
    updated_at: string;
    expires_at: string;
  };
}
