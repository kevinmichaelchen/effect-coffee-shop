import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { SqliteClient } from "#effect-smol/sql/sqlite-bun";

const coffeeSqliteConfig = Config.all({
  filename: Config.string("COFFEE_SQLITE_PATH").pipe(Config.withDefault(".data/coffee.sqlite")),
});

export const BunSqlClientLive = Layer.unwrap(
  Effect.gen(function* () {
    const config = yield* coffeeSqliteConfig;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    yield* fs.makeDirectory(path.dirname(config.filename), { recursive: true });

    return SqliteClient.layer(config);
  }),
);
