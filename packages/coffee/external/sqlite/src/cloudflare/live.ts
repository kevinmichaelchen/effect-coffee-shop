/**
 * Builds the SQLite persistence layer for Cloudflare D1 runtimes.
 *
 * The D1 schema is owned by the Alchemy `Cloudflare.D1.Database` resource in
 * `infra/alchemy/cloudflare.ts`, which applies the checked-in migrations at
 * deploy time, both under `alchemy dev` emulation and against real D1. The
 * Worker therefore never migrates on cold start. `migrateCloudflareD1` covers
 * tests and tooling that start from an empty D1 binding outside an Alchemy
 * deploy; it reads the migration files, so callers provide `FileSystem` and
 * `Path`.
 *
 * @module
 */
import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SqlCoffeeAppLive } from "../sql/live.ts";
import { migrateSqlDatabase } from "../sql/migrate.ts";
import { SqlCoffeeSchemaReady } from "../sql/schema-ready.ts";

export const migrateCloudflareD1 = (db: D1Database) =>
  migrateSqlDatabase({ transactional: false }).pipe(Effect.provide(D1Client.layer({ db })));

export const CloudflareSqlCoffeeSchemaLive = Layer.succeed(SqlCoffeeSchemaReady, { ready: true });

export const makeCloudflareCoffeeAppLive = (db: D1Database) =>
  SqlCoffeeAppLive.pipe(
    Layer.provide(D1Client.layer({ db })),
    Layer.provide(CloudflareSqlCoffeeSchemaLive),
  );
