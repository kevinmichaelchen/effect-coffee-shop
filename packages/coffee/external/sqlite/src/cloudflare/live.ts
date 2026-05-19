import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { createD1Client } from "sqlfu";
import { migrate } from "../sql/migrations/.generated/migrations.ts";
import { SqlCoffeeAppLive } from "../sql/live.ts";
import { SqlCoffeeSchemaReady } from "../sql/schema-ready.ts";

const schemaReady = { ready: true } satisfies { readonly ready: true };

export class CoffeeDatabase extends Context.Service<CoffeeDatabase, D1Database>()(
  "effect-coffee-shop/cloudflare/CoffeeDatabase",
) {}

export const makeCloudflareCoffeeDatabaseLive = (db: D1Database) =>
  Layer.succeed(CoffeeDatabase, db);

export const CloudflareCoffeeD1SqlLive = Layer.unwrap(
  Effect.gen(function* () {
    const db = yield* CoffeeDatabase;
    return D1Client.layer({ db });
  }),
);

export const CloudflareSqlCoffeeSchemaLive = Layer.effect(
  SqlCoffeeSchemaReady,
  Effect.gen(function* () {
    const db = yield* CoffeeDatabase;
    return yield* Effect.promise(async () => migrate(createD1Client(db))).pipe(
      Effect.as(schemaReady),
    );
  }),
);

export const makeCloudflareSqlCoffeeSchemaLive = (db: D1Database) =>
  CloudflareSqlCoffeeSchemaLive.pipe(Layer.provide(makeCloudflareCoffeeDatabaseLive(db)));

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(
    Layer.provide(CloudflareCoffeeD1SqlLive),
    Layer.provide(CloudflareSqlCoffeeSchemaLive),
    Layer.provide(makeCloudflareCoffeeDatabaseLive(db)),
  );
