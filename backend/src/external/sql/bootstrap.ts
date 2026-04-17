import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SqlClient } from "effect/unstable/sql";
import { menuItems } from "#domain/menu";
import { coffeeMigrations } from "./migrations/index.ts";
import { toSqlMenuItemSeed } from "./models.ts";

// Schema + seed bootstrap for the coffee repositories. D1 does not support
// client-side transactions (`@effect/sql-d1`'s `transactionAcquirer` dies by
// design), so we cannot use `effect/unstable/sql/Migrator`, which wraps its
// run in `sql.withTransaction`. This runner uses the same `_coffee_migrations`
// tracking table but executes each migration outside a transaction, which
// means every migration must be idempotent (e.g. `CREATE TABLE IF NOT EXISTS`).
// After migrations, menu seed rows are upserted on every boot so code is the
// source of truth for the menu.

const runCoffeeMigrations = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS _coffee_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `;

  const applied = yield* sql<{
    readonly id: number;
  }>`SELECT id FROM _coffee_migrations`;
  const appliedIds = new Set(applied.map((row) => row.id));
  const pending = coffeeMigrations.filter((migration) => !appliedIds.has(migration.id));

  yield* Effect.forEach(
    pending,
    (migration) =>
      migration.run.pipe(
        Effect.andThen(
          sql`INSERT INTO _coffee_migrations (id, name) VALUES (${migration.id}, ${migration.name})`,
        ),
      ),
    { concurrency: 1, discard: true },
  );
});

const seedMenuItems = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* Effect.forEach(
    menuItems,
    (menuItem, sortOrder) =>
      sql`
        INSERT INTO menu_items ${sql.insert(toSqlMenuItemSeed(menuItem, sortOrder))}
        ON CONFLICT (id) DO UPDATE SET
          name = excluded.name,
          kind = excluded.kind,
          sortOrder = excluded.sortOrder,
          basePriceCents = excluded.basePriceCents,
          availableMilks = excluded.availableMilks,
          availableTemperatures = excluded.availableTemperatures,
          maxShots = excluded.maxShots
      `,
    { concurrency: 1, discard: true },
  );
});

const bootstrap = Effect.gen(function* () {
  yield* runCoffeeMigrations;
  yield* seedMenuItems;
});

export const SqlCoffeeBootstrapLive = Layer.effectDiscard(bootstrap);
