import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import { SqlBatchCommit } from "@yielded/auth-persistence/Adapter";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { SqlClient } from "effect/sql";

export const transactionalAuthDatabase = <E>(database: Layer.Layer<SqlClient.SqlClient, E>) =>
  Layer.merge(database, Layer.succeed(SqlBatchCommit, undefined));

export const d1AuthDatabase = (db: D1Database) => {
  const database = D1Client.layer({ db });
  return Layer.effect(
    SqlBatchCommit,
    Effect.gen(function* () {
      const client = yield* D1Client.D1Client;
      return {
        client,
        execute: (statements: Parameters<typeof client.batch>[0]) =>
          client.batch(statements).pipe(Effect.asVoid),
      };
    }),
  ).pipe(Layer.provideMerge(database));
};
