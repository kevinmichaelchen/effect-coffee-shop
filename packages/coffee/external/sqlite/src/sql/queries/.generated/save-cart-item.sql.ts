import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  cart_items (
    owner_user_id,
    id,
    position,
    drink_id,
    size,
    milk,
    temperature,
    shots,
    notes,
    quantity
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
    ?
  );
`.trim();
const query = (params: saveCartItem.Params) => ({
  name: "saveCartItem",
  sql,
  args: [
    params.item.owner_user_id,
    params.item.id,
    params.item.position,
    params.item.drink_id,
    params.item.size,
    params.item.milk,
    params.item.temperature,
    params.item.shots,
    params.item.notes,
    params.item.quantity,
  ],
});

export const saveCartItem = Object.assign(
  function saveCartItem(params: saveCartItem.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace saveCartItem {
  export type Params = {
    item: {
      owner_user_id: string;
      id: string;
      position: number;
      drink_id: string;
      size: string;
      milk: string;
      temperature: string;
      shots: number;
      notes: string | null;
      quantity: number;
    };
  };
}
