import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
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
from pending_order_confirmation_items
where owner_user_id = ?
order by position;
`.trim();
const query = (params: listPendingOrderConfirmationItems.Params) => ({
  name: "listPendingOrderConfirmationItems",
  sql,
  args: [params.param1],
});

export const listPendingOrderConfirmationItems = Object.assign(
  function listPendingOrderConfirmationItems(params: listPendingOrderConfirmationItems.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listPendingOrderConfirmationItems.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listPendingOrderConfirmationItems {
  export type Params = {
    param1: string;
  };
  export type Result = {
    owner_user_id: string;
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
