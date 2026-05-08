import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select *
from orders
where status = ?
order by createdat, id;
`.trim();
const query = (params: listOrdersByStatus.Params) => ({
  name: "listOrdersByStatus",
  sql,
  args: [params.status],
});

export const listOrdersByStatus = Object.assign(
  function listOrdersByStatus(params: listOrdersByStatus.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listOrdersByStatus.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrdersByStatus {
  export type Params = {
    status: string;
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
