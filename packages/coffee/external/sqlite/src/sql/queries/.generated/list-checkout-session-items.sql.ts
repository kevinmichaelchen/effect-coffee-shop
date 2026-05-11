import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select
  session_id,
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
from checkout_session_items
where session_id = ?
order by position;
`.trim();
const query = (params: listCheckoutSessionItems.Params) => ({
  name: "listCheckoutSessionItems",
  sql,
  args: [params.sessionId],
});

export const listCheckoutSessionItems = Object.assign(
  function listCheckoutSessionItems(params: listCheckoutSessionItems.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listCheckoutSessionItems.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listCheckoutSessionItems {
  export type Params = {
    sessionId: string;
  };
  export type Result = {
    session_id: string;
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
