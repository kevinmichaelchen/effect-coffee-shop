/**
 * PGlite-backed wiring for the Coffee database service.
 *
 * Runs the same Drizzle migrations and repositories against an in-process
 * WASM Postgres (`@electric-sql/pglite`) via `drizzle-orm/effect-pglite`, so
 * the full persistence stack is testable with no Postgres server.
 *
 * @module
 */
import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PgliteClient } from "@effect/sql-pglite";
import type { PGliteInterface } from "@electric-sql/pglite";
import * as PgliteDrizzle from "drizzle-orm/effect-pglite";
import { migrate } from "drizzle-orm/effect-pglite/migrator";
import { CoffeeDb } from "./Db.ts";
import { DrizzlePostgresSchemaReady } from "./schema-ready.ts";

const migrationsFolder = NodePath.join(import.meta.dirname, "migrations");

/**
 * Backs {@link CoffeeDb} with an existing PGlite instance. The instance is
 * caller-owned; closing it remains the caller's responsibility.
 */
export const makePgliteCoffeeDbLayer = (liveClient: PGliteInterface) =>
  Layer.effect(CoffeeDb, PgliteDrizzle.make()).pipe(
    Layer.provide(PgliteDrizzle.DefaultServices),
    Layer.provide(PgliteClient.layer({ liveClient })),
  );

export const DrizzlePgliteSchemaLive = Layer.effect(
  DrizzlePostgresSchemaReady,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    yield* migrate(db, { migrationsFolder });

    return { ready: true };
  }),
);
