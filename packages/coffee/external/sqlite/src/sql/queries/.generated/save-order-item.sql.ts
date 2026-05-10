import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  order_items (
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
    ?
  );
`.trim();
const query = (params: saveOrderItem.Params) => ({
  name: "saveOrderItem",
  sql,
  args: [
    params.item.order_id,
    params.item.position,
    params.item.drink_id,
    params.item.drink_name,
    params.item.size,
    params.item.milk,
    params.item.temperature,
    params.item.shots,
    params.item.notes,
    params.item.quantity,
    params.item.unit_price_cents,
    params.item.line_total_cents,
  ],
});

export const saveOrderItem = Object.assign(
  function saveOrderItem(params: saveOrderItem.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace saveOrderItem {
  export type Params = {
    item: {
      order_id: string;
      position: number;
      drink_id: string;
      drink_name: string;
      size: string;
      milk: string;
      temperature: string;
      shots: number;
      notes: string | null;
      quantity: number;
      unit_price_cents: number;
      line_total_cents: number;
    };
  };
}
