import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { SqlClient, type SqlError } from "effect/unstable/sql";
import { menuItems } from "#domain/menu";
import { toSqlMenuItemSeed } from "./models.ts";

const bootstrapSqlPersistence = Effect.fn("CoffeeSql.bootstrapSqlPersistence")(
  function* (): Effect.fn.Return<void, SqlError.SqlError, SqlClient.SqlClient> {
    const sql = yield* SqlClient.SqlClient;

    yield* sql`
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      sortOrder INTEGER NOT NULL,
      basePriceCents INTEGER NOT NULL,
      availableMilks TEXT NOT NULL,
      availableTemperatures TEXT NOT NULL,
      maxShots INTEGER NOT NULL
    )
  `;

    yield* sql`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customerName TEXT NOT NULL,
      drinkId TEXT NOT NULL,
      drinkName TEXT NOT NULL,
      size TEXT NOT NULL,
      milk TEXT NOT NULL,
      temperature TEXT NOT NULL,
      shots INTEGER NOT NULL,
      notes TEXT,
      status TEXT NOT NULL,
      priceCents INTEGER NOT NULL,
      createdAt TEXT NOT NULL
    )
  `;

    yield* sql`
    CREATE INDEX IF NOT EXISTS orders_created_at_idx
    ON orders (createdAt, id)
  `;

    yield* sql`
    CREATE INDEX IF NOT EXISTS orders_status_created_at_idx
    ON orders (status, createdAt, id)
  `;

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
  },
);

export const SqlCoffeePersistenceLive = Layer.effectDiscard(bootstrapSqlPersistence());
