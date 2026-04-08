import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient, SqlSchema } from "effect/unstable/sql";
import type { MenuItem } from "#domain/menu";
import { PersistenceError } from "#service/errors";
import { MenuRepository } from "#service/ports/MenuRepository";
import { SqlMenuItemModel } from "./models.ts";

const toMenuItem = (item: SqlMenuItemModel): MenuItem => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePriceCents: item.basePriceCents,
  availableMilks: item.availableMilks,
  availableTemperatures: item.availableTemperatures,
  maxShots: item.maxShots,
});

const makeSqlMenuQueries = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const listRows = () =>
    SqlSchema.findAll({
      Request: Schema.Void,
      Result: SqlMenuItemModel,
      execute: () => sql`
      SELECT
        id,
        name,
        kind,
        basePriceCents,
        availableMilks,
        availableTemperatures,
        maxShots
      FROM menu_items
      ORDER BY sortOrder, id
    `,
    })(undefined);

  const findByIdRow = (drinkId: string) =>
    SqlSchema.findOneOption({
      Request: Schema.String,
      Result: SqlMenuItemModel,
      execute: (id) => sql`
      SELECT
        id,
        name,
        kind,
        basePriceCents,
        availableMilks,
        availableTemperatures,
        maxShots
      FROM menu_items
      WHERE id = ${id}
    `,
    })(drinkId);

  const list = listRows().pipe(Effect.map((items) => items.map(toMenuItem)));

  const findById = (drinkId: string) =>
    findByIdRow(drinkId).pipe(Effect.map(Option.map(toMenuItem)));

  return { list, findById } as const;
});

export const SqlMenuRepositoryLive = Layer.effect(
  MenuRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlMenuQueries;

    return MenuRepository.of({
      list: queries.list.pipe(PersistenceError.refail("Failed to load the coffee menu")),
      findById: (drinkId) =>
        queries
          .findById(drinkId)
          .pipe(PersistenceError.refail(`Failed to load menu item "${drinkId}"`)),
    });
  }),
);
