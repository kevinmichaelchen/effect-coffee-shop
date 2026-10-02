/**
 * Builds the SQLite persistence layer for Bun runtimes.
 *
 * @module
 */
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SqlCoffeeAppLive } from "../sql/live.ts";
import { migrateSqlDatabase } from "../sql/migrate.ts";
import { SqlCoffeeSchemaReady } from "../sql/schema-ready.ts";
import { BunSqlClientLive } from "./sqlite.ts";

const BunSqlCoffeeSchemaLive = Layer.effect(
  SqlCoffeeSchemaReady,
  migrateSqlDatabase({ transactional: true }).pipe(
    Effect.as(SqlCoffeeSchemaReady.of({ ready: true })),
  ),
);

export const BunCoffeeAppLive = SqlCoffeeAppLive.pipe(
  Layer.provide(
    Layer.merge(BunSqlClientLive, Layer.provide(BunSqlCoffeeSchemaLive, BunSqlClientLive)),
  ),
  Layer.provide(BunServices.layer),
);
