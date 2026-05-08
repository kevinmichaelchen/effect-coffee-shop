import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { asc, eq } from "drizzle-orm";
import type { MenuItem } from "@effect-coffee-shop/coffee-core/domain/menu";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzleMenuItemRowSchema, toMenuItem } from "../db/models.ts";
import { menuItemsTable } from "../db/schema.ts";

const decodeMenuItemRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleMenuItemRowSchema));
const decodeMenuItemRow = Schema.decodeUnknownEffect(DrizzleMenuItemRowSchema);

const decodeOptionalMenuItem = (rows: ReadonlyArray<unknown>) =>
  Option.match(Arr.head(rows), {
    onNone: () => Effect.succeed(Option.none<MenuItem>()),
    onSome: (row) => decodeMenuItemRow(row).pipe(Effect.map(toMenuItem), Effect.map(Option.some)),
  });

export const DrizzleMenuRepositoryLive = Layer.effect(
  MenuRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    const list = db
      .select()
      .from(menuItemsTable)
      .orderBy(asc(menuItemsTable.sortOrder), asc(menuItemsTable.id))
      .pipe(
        Effect.flatMap(decodeMenuItemRows),
        Effect.map((items) => items.map(toMenuItem)),
      );

    const findById = (drinkId: string) =>
      db
        .select()
        .from(menuItemsTable)
        .where(eq(menuItemsTable.id, drinkId))
        .limit(1)
        .pipe(Effect.flatMap(decodeOptionalMenuItem));

    return MenuRepository.of({
      list: list.pipe(PersistenceError.refail("Failed to load the coffee menu")),
      findById: (drinkId) =>
        findById(drinkId).pipe(PersistenceError.refail(`Failed to load menu item "${drinkId}"`)),
    });
  }),
);
