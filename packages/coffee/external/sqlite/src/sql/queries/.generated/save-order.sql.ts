import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  orders (
    id,
    customer_name,
    owner_user_id,
    drink_id,
    drink_name,
    size,
    milk,
    temperature,
    shots,
    notes,
    status,
    price_cents,
    created_at
  )
values
  (
    ?,
    ?,
    ?,
    ?,
    ?,
    ?,
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
  customer_name = excluded.customer_name,
  owner_user_id = excluded.owner_user_id,
  drink_id = excluded.drink_id,
  drink_name = excluded.drink_name,
  size = excluded.size,
  milk = excluded.milk,
  temperature = excluded.temperature,
  shots = excluded.shots,
  notes = excluded.notes,
  status = excluded.status,
  price_cents = excluded.price_cents,
  created_at = excluded.created_at
returning *;
`.trim();
const query = (params: saveOrder.Params) => ({
  name: "saveOrder",
  sql,
  args: [
    params.order.id,
    params.order.customer_name,
    params.order.owner_user_id,
    params.order.drink_id,
    params.order.drink_name,
    params.order.size,
    params.order.milk,
    params.order.temperature,
    params.order.shots,
    params.order.notes,
    params.order.status,
    params.order.price_cents,
    params.order.created_at,
  ],
});

export const saveOrder = Object.assign(
  function saveOrder(params: saveOrder.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<saveOrder.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows[0];
    });
  },
  { sql, query },
);

export namespace saveOrder {
  export type Params = {
    order: {
      id: string;
      customer_name: string;
      owner_user_id: string;
      drink_id: string;
      drink_name: string;
      size: string;
      milk: string;
      temperature: string;
      shots: number;
      notes: string | null;
      status: string;
      price_cents: number;
      created_at: string;
    };
  };
  export type Result = {
    id: string;
    customer_name: string;
    owner_user_id: string;
    drink_id: string;
    drink_name: string;
    size: string;
    milk: string;
    temperature: string;
    shots: number;
    notes?: string;
    status: string;
    price_cents: number;
    created_at: string;
  };
}
