import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  orders (id, customer_name, owner_user_id, status, total_price_cents, created_at)
values
  (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?
  )
on conflict (id) do update
set
  customer_name = excluded.customer_name,
  owner_user_id = excluded.owner_user_id,
  status = excluded.status,
  total_price_cents = excluded.total_price_cents,
  created_at = excluded.created_at;
`.trim();
const query = (params: saveOrder.Params) => ({
  name: "saveOrder",
  sql,
  args: [
    params.order.id,
    params.order.customerName,
    params.order.ownerUserId,
    params.order.status,
    params.order.totalPriceCents,
    params.order.createdAt,
  ],
});

export const saveOrder = Object.assign(
  function saveOrder(params: saveOrder.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace saveOrder {
  export type Params = {
    order: {
      id: string;
      customerName: string;
      ownerUserId: string;
      status: string;
      totalPriceCents: number;
      createdAt: string;
    };
  };
}
