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
where id = ?;
`.trim();
const query = (params: findCheckoutSessionById.Params) => ({
  name: "findCheckoutSessionById",
  sql,
  args: [params.id],
});

export const findCheckoutSessionById = Object.assign(
  function findCheckoutSessionById(params: findCheckoutSessionById.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findCheckoutSessionById.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows.length > 0 ? rows[0] : null;
    });
  },
  { sql, query },
);

export namespace findCheckoutSessionById {
  export type Params = {
    id: string;
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
