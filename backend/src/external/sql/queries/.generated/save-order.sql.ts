import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  orders (
    id,
    customername,
    owneruserid,
    drinkid,
    drinkname,
    size,
    milk,
    temperature,
    shots,
    notes,
    status,
    pricecents,
    createdat
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
  customername = excluded.customername,
  owneruserid = excluded.owneruserid,
  drinkid = excluded.drinkid,
  drinkname = excluded.drinkname,
  size = excluded.size,
  milk = excluded.milk,
  temperature = excluded.temperature,
  shots = excluded.shots,
  notes = excluded.notes,
  status = excluded.status,
  pricecents = excluded.pricecents,
  createdat = excluded.createdat
returning *;
`.trim();
const query = (params: saveOrder.Params) => ({
  name: "saveOrder",
  sql,
  args: [
    params.order.id,
    params.order.customername,
    params.order.owneruserid,
    params.order.drinkid,
    params.order.drinkname,
    params.order.size,
    params.order.milk,
    params.order.temperature,
    params.order.shots,
    params.order.notes,
    params.order.status,
    params.order.pricecents,
    params.order.createdat,
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
      customername: string;
      owneruserid: string;
      drinkid: string;
      drinkname: string;
      size: string;
      milk: string;
      temperature: string;
      shots: number;
      notes: string | null;
      status: string;
      pricecents: number;
      createdat: string;
    };
  };
  export type Result = {
    id: string;
    customername: string;
    owneruserid: string;
    drinkid: string;
    drinkname: string;
    size: string;
    milk: string;
    temperature: string;
    shots: number;
    notes?: string;
    status: string;
    pricecents: number;
    createdat: string;
  };
}
