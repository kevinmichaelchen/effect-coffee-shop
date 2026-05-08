import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select *
from orders
where id = ?
limit 1;
`.trim();
const query = (params: findOrderById.Params) => ({ name: "findOrderById", sql, args: [params.id] });

export const findOrderById = Object.assign(
  function findOrderById(params: findOrderById.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<findOrderById.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows.length > 0 ? rows[0] : null;
    });
  },
  { sql, query },
);

export namespace findOrderById {
  export type Params = {
    id: string;
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
