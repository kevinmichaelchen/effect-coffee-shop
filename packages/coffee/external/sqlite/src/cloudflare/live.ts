/**
 * Builds the SQLite persistence layer for Cloudflare D1 runtimes.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createD1Client } from "sqlfu";
import { migrate } from "../sql/migrations/.generated/migrations.ts";
import { SqlCoffeeAppLive } from "../sql/live.ts";
import { SqlCoffeeSchemaReady } from "../sql/schema-ready.ts";

export const makeCloudflareSqlCoffeeSchemaLive = (db: D1Database) =>
  Layer.effect(
    SqlCoffeeSchemaReady,
    Effect.promise(async () => migrate(createD1Client(db))).pipe(Effect.as({ ready: true })),
  );

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(
    Layer.provide(D1Client.layer({ db })),
    Layer.provide(makeCloudflareSqlCoffeeSchemaLive(db)),
  );
