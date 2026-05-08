import * as BunServices from "@effect/platform-bun/BunServices";
import { Database } from "bun:sqlite";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { createBunClient } from "sqlfu";
import { migrate } from "../sql/migrations/.generated/migrations.ts";
import { SqlCoffeeAppLive } from "../sql/live.ts";
import { SqlCoffeeSchemaReady } from "../sql/schema-ready.ts";
import { BunSqlClientLive, coffeeSqliteConfig } from "./sqlite.ts";

const BunSqlCoffeeSchemaLive = Layer.effect(
  SqlCoffeeSchemaReady,
  Effect.gen(function* () {
    const config = yield* coffeeSqliteConfig;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs.makeDirectory(path.dirname(config.filename), { recursive: true });

    yield* Effect.sync(() => {
      const db = new Database(config.filename);
      migrate(createBunClient(db));
      db.close();
    });

    return { ready: true };
  }),
);

export const BunCoffeeAppLive = SqlCoffeeAppLive.pipe(
  Layer.provide(BunSqlClientLive),
  Layer.provide(BunSqlCoffeeSchemaLive),
  Layer.provide(BunServices.layer),
);
