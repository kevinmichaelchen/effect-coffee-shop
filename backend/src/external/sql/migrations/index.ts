import type * as Effect from "effect/Effect";
import type { SqlClient } from "effect/unstable/sql";
import { migration as init } from "./0001_init_coffee.ts";

interface Migration {
  readonly id: number;
  readonly name: string;
  readonly run: Effect.Effect<void, unknown, SqlClient.SqlClient>;
}

export const coffeeMigrations: ReadonlyArray<Migration> = [
  { id: 1, name: "init_coffee", run: init },
];
