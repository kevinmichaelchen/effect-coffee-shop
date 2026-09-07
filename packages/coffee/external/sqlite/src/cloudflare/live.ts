/**
 * Builds the SQLite persistence layer for Cloudflare D1 runtimes.
 *
 * The D1 schema is owned by the Alchemy `Cloudflare.D1.Database` resource in
 * `infra/alchemy/cloudflare.ts`, which applies the checked-in migrations at
 * deploy time, both under `alchemy dev` emulation and against real D1. The
 * Worker therefore never migrates on cold start. `migrateCloudflareD1` covers
 * tests and tooling that start from an empty D1 binding outside an Alchemy
 * deploy.
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

export const migrateCloudflareD1 = Effect.fn("CloudflareD1.migrate")(function* (db: D1Database) {
  yield* Effect.promise(() => migrate(createD1Client(db)));
});

export const CloudflareSqlCoffeeSchemaLive = Layer.succeed(SqlCoffeeSchemaReady, { ready: true });

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(
    Layer.provide(D1Client.layer({ db })),
    Layer.provide(CloudflareSqlCoffeeSchemaLive),
  );
