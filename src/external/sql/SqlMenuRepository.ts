import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient, SqlSchema, type SqlError } from "effect/unstable/sql";
import type { MenuItem } from "#domain/menu";
import { MenuRepository } from "#service/ports/MenuRepository";
import { SqlMenuItemModel } from "./models.ts";

type SqlRepositoryError = Schema.SchemaError | SqlError.SqlError;
type ListMenuQuery = () => Effect.Effect<ReadonlyArray<MenuItem>, SqlRepositoryError>;
type FindMenuItemByIdQuery = (
  drinkId: string,
) => Effect.Effect<MenuItem | undefined, SqlRepositoryError>;

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

  const listRows = (): Effect.Effect<ReadonlyArray<SqlMenuItemModel>, SqlRepositoryError> =>
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

  const findByIdRow = (
    drinkId: string,
  ): Effect.Effect<Option.Option<SqlMenuItemModel>, SqlRepositoryError> =>
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

  const list = listRows().pipe(
    Effect.map((items) => items.map(toMenuItem)),
  ) satisfies ReturnType<ListMenuQuery>;

  const findById = ((drinkId: string) =>
    findByIdRow(drinkId).pipe(
      Effect.map((menuItem) => {
        const item = Option.getOrUndefined(menuItem);
        return item === undefined ? undefined : toMenuItem(item);
      }),
    )) satisfies FindMenuItemByIdQuery;

  return { list, findById } as const;
});

export const SqlMenuRepositoryLive = Layer.effect(
  MenuRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlMenuQueries;

    return MenuRepository.of({
      list: queries.list.pipe(Effect.orDie),
      findById: (drinkId) => queries.findById(drinkId).pipe(Effect.orDie),
    });
  }),
);
