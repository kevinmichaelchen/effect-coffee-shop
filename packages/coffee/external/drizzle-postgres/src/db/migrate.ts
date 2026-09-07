/**
 * Runs Drizzle migrations for the Postgres persistence schema.
 *
 * @module
 */
import * as Path from "effect/Path";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { migrate } from "drizzle-orm/effect-postgres/migrator";
import { CoffeeDb } from "./Db.ts";
import { DrizzlePostgresSchemaReady } from "./schema-ready.ts";

export const DrizzlePostgresSchemaLive = Layer.effect(
  DrizzlePostgresSchemaReady,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;
    const path = yield* Path.Path;
    const migrationsFolder = path.join(import.meta.dirname, "migrations");

    yield* migrate(db, { migrationsFolder });

    return { ready: true };
  }),
).pipe(Layer.provide(Path.layer));
