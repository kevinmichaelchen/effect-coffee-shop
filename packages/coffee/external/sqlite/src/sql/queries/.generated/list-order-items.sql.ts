import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  order_id,
  position,
  drink_id,
  drink_name,
  size,
  milk,
  temperature,
  shots,
  notes,
  quantity,
  unit_price_cents,
  line_total_cents
from order_items
where order_id = ?
order by position;
`.trim();
const query = (params: listOrderItems.Params) => ({
  name: "listOrderItems",
  sql,
  args: [params.orderId],
});

export const listOrderItems = Object.assign(
  function listOrderItems(params: listOrderItems.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listOrderItems.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrderItems {
  export type Params = {
    orderId: string;
  };
  export type Result = {
    order_id: string;
    position: number;
    drink_id: string;
    drink_name: string;
    size: string;
    milk: string;
    temperature: string;
    shots: number;
    notes?: string;
    quantity: number;
    unit_price_cents: number;
    line_total_cents: number;
  };
}
