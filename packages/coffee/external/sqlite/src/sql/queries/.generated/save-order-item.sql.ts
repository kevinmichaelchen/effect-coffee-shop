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
    params.item.orderId,
    params.item.position,
    params.item.drinkId,
    params.item.drinkName,
    params.item.size,
    params.item.milk,
    params.item.temperature,
    params.item.shots,
    params.item.notes,
    params.item.quantity,
    params.item.unitPriceCents,
    params.item.lineTotalCents,
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
      orderId: string;
      position: number;
      drinkId: string;
      drinkName: string;
      size: string;
      milk: string;
      temperature: string;
      shots: number;
      notes: string | null;
      quantity: number;
      unitPriceCents: number;
      lineTotalCents: number;
    };
  };
}
