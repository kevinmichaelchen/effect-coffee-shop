import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  checkout_sessions (
    id,
    owner_user_id,
    status,
    total_price_cents,
    created_at,
    updated_at,
    expires_at
  )
values
  (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
on conflict (id) do update
set
  owner_user_id = excluded.owner_user_id,
  status = excluded.status,
  total_price_cents = excluded.total_price_cents,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  expires_at = excluded.expires_at;
`.trim();
const query = (params: saveCheckoutSession.Params) => ({
  name: "saveCheckoutSession",
  sql,
  args: [
    params.session.id,
    params.session.ownerUserId,
    params.session.status,
    params.session.totalPriceCents,
    params.session.createdAt,
    params.session.updatedAt,
    params.session.expiresAt,
  ],
});

export const saveCheckoutSession = Object.assign(
  function saveCheckoutSession(params: saveCheckoutSession.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace saveCheckoutSession {
  export type Params = {
    session: {
      id: string;
      ownerUserId: string;
      status: string;
      totalPriceCents: number;
      createdAt: string;
      updatedAt: string;
      expiresAt: string;
    };
  };
}
