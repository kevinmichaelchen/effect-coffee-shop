import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
select *
from orders
where owneruserid = ? and status = ?
order by createdat, id;
`.trim();
const query = (params: listOrdersByOwnerAndStatus.Params) => ({
  name: "listOrdersByOwnerAndStatus",
  sql,
  args: [params.ownerUserId, params.status],
});

export const listOrdersByOwnerAndStatus = Object.assign(
  function listOrdersByOwnerAndStatus(params: listOrdersByOwnerAndStatus.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      const rows = yield* sqlClient.unsafe<listOrdersByOwnerAndStatus.Result>(
        generatedQuery.sql,
        generatedQuery.args,
      );
      return rows;
    });
  },
  { sql, query },
);

export namespace listOrdersByOwnerAndStatus {
  export type Params = {
    ownerUserId: string;
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
