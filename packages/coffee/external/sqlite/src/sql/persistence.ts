/**
 * Provides SQL helpers for transactional Coffee persistence operations.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { menuItems } from "@effect-coffee-shop/coffee-core/domain/menu";
import { toSqlMenuItemSeed } from "./models.ts";
import { seedMenuItem } from "./queries/.generated/seed-menu-item.sql.ts";
import { SqlCoffeeSchemaReady } from "./schema-ready.ts";

const bootstrapSqlPersistence = Effect.fn("CoffeeSql.bootstrapSqlPersistence")(function* () {
  yield* SqlCoffeeSchemaReady;

  yield* Effect.forEach(
    menuItems,
    (menuItem, sortOrder) =>
      seedMenuItem({
        item: toSqlMenuItemSeed(menuItem, sortOrder),
      }),
    { concurrency: 1, discard: true },
  );
});

export const SqlCoffeePersistenceLive = Layer.effectDiscard(bootstrapSqlPersistence());
