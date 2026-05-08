import * as NodePath from "node:path";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { migrate } from "drizzle-orm/effect-postgres/migrator";
import { CoffeeDb } from "./Db.ts";
import { DrizzlePostgresSchemaReady } from "./schema-ready.ts";

const migrationsFolder = NodePath.join(import.meta.dirname, "migrations");

export const DrizzlePostgresSchemaLive = Layer.effect(
  DrizzlePostgresSchemaReady,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    yield* migrate(db, { migrationsFolder });

    return { ready: true };
  }),
);
