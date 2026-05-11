import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  pending_order_confirmation_items (
    owner_user_id,
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
  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`.trim();
const query = (params: savePendingOrderConfirmationItem.Params) => ({
  name: "savePendingOrderConfirmationItem",
  sql,
  args: [
    params.param1,
    params.param2,
    params.param3,
    params.param4,
    params.param5,
    params.param6,
    params.param7,
    params.param8,
    params.param9,
    params.param10,
    params.param11,
    params.param12,
  ],
});

export const savePendingOrderConfirmationItem = Object.assign(
  function savePendingOrderConfirmationItem(params: savePendingOrderConfirmationItem.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace savePendingOrderConfirmationItem {
  export type Params = {
    param1: string;
    param2: number | null;
    param3: string;
    param4: string;
    param5: string;
    param6: string;
    param7: string;
    param8: number;
    param9: string | null;
    param10: number;
    param11: number;
    param12: number;
  };
}
