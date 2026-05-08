import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { menuItems } from "@effect-coffee-shop/coffee-core/domain/menu";
import { CoffeeDb } from "./Db.ts";
import { DrizzlePostgresSchemaReady } from "./schema-ready.ts";
import { toMenuItemSeed } from "./models.ts";
import { menuItemsTable } from "./schema.ts";

const bootstrapDrizzlePostgresPersistence = Effect.fn("CoffeeDrizzlePostgres.bootstrapPersistence")(
  function* () {
    yield* DrizzlePostgresSchemaReady;

    const db = yield* CoffeeDb;

    yield* Effect.forEach(
      menuItems,
      (menuItem, sortOrder) => {
        const seed = toMenuItemSeed(menuItem, sortOrder);

        return db.insert(menuItemsTable).values(seed).onConflictDoUpdate({
          target: menuItemsTable.id,
          set: seed,
        });
      },
      { concurrency: 1, discard: true },
    );
  },
);

export const DrizzlePostgresPersistenceLive = Layer.effectDiscard(
  bootstrapDrizzlePostgresPersistence(),
);
