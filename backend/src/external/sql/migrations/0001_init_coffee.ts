import * as Effect from "effect/Effect";
import { SqlClient } from "effect/unstable/sql";

export const migration = Effect.gen(function* () {
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
      ownerUserId TEXT NOT NULL DEFAULT '__legacy__',
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

  yield* sql`
    CREATE INDEX IF NOT EXISTS orders_owner_user_id_created_at_idx
    ON orders (ownerUserId, createdAt, id)
  `;

  yield* sql`
    CREATE INDEX IF NOT EXISTS orders_owner_user_id_status_created_at_idx
    ON orders (ownerUserId, status, createdAt, id)
  `;
});
