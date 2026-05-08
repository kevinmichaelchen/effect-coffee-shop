import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

const sql = `
insert into
  menu_items (
    id,
    name,
    kind,
    sortorder,
    basepricecents,
    availablemilks,
    availabletemperatures,
    maxshots
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
    ?
  )
on conflict (id) do update
set
  name = excluded.name,
  kind = excluded.kind,
  sortorder = excluded.sortorder,
  basepricecents = excluded.basepricecents,
  availablemilks = excluded.availablemilks,
  availabletemperatures = excluded.availabletemperatures,
  maxshots = excluded.maxshots;
`.trim();
const query = (params: seedMenuItem.Params) => ({
  name: "seedMenuItem",
  sql,
  args: [
    params.item.id,
    params.item.name,
    params.item.kind,
    params.item.sortorder,
    params.item.basepricecents,
    params.item.availablemilks,
    params.item.availabletemperatures,
    params.item.maxshots,
  ],
});

export const seedMenuItem = Object.assign(
  function seedMenuItem(params: seedMenuItem.Params) {
    return Effect.gen(function* () {
      const sqlClient = yield* SqlClient.SqlClient;
      const generatedQuery = query(params);
      return yield* sqlClient.unsafe(generatedQuery.sql, generatedQuery.args).raw;
    });
  },
  { sql, query },
);

export namespace seedMenuItem {
  export type Params = {
    item: {
      id: string;
      name: string;
      kind: string;
      sortorder: number;
      basepricecents: number;
      availablemilks: string;
      availabletemperatures: string;
      maxshots: number;
    };
  };
}
