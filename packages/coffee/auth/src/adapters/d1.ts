/**
 * Auth storage on Cloudflare D1: the D1 SQL client, with D1's batch as the
 * atomic commit.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import { SqlBatchCommit } from "@yielded/auth-persistence/Adapter";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { AuthDatabase } from "../server.ts";

// D1's client fails only on bad configuration, which no request can recover from.
export const d1AuthDatabase = (db: D1Database): AuthDatabase =>
  Layer.effect(
    SqlBatchCommit,
    Effect.gen(function* () {
      const client = yield* D1Client.D1Client;
      return {
        client,
        execute: (statements: Parameters<typeof client.batch>[0]) =>
          client.batch(statements).pipe(Effect.asVoid),
      };
    }),
  ).pipe(Layer.provideMerge(D1Client.layer({ db })), Layer.orDie);
