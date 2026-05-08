import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { MenuItem } from "#domain/menu";
import { PersistenceError } from "#service/errors";
import { MenuRepository } from "#service/ports/MenuRepository";
import { findMenuItemById } from "./queries/.generated/find-menu-item-by-id.sql.ts";
import { listMenuItems } from "./queries/.generated/list-menu-items.sql.ts";
import { SqlMenuItemModel } from "./models.ts";

const toMenuItem = (item: SqlMenuItemModel): MenuItem => ({
  id: item.id,
  name: item.name,
  kind: item.kind,
  basePriceCents: item.basepricecents,
  availableMilks: item.availablemilks,
  availableTemperatures: item.availabletemperatures,
  maxShots: item.maxshots,
});

const decodeSqlMenuItems = Schema.decodeUnknownEffect(Schema.Array(SqlMenuItemModel));
const decodeSqlMenuItem = Schema.decodeUnknownEffect(SqlMenuItemModel);

const decodeOptionalSqlMenuItem = (row: unknown) =>
  Option.match(Option.fromNullishOr(row), {
    onNone: () => Effect.succeed(Option.none<MenuItem>()),
    onSome: (row) => decodeSqlMenuItem(row).pipe(Effect.map(toMenuItem), Effect.map(Option.some)),
  });

const makeSqlMenuQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const list = Effect.provideService(
    listMenuItems().pipe(
      Effect.flatMap(decodeSqlMenuItems),
      Effect.map((items) => items.map(toMenuItem)),
    ),
    SqlClient.SqlClient,
    sqlClient,
  );

  return {
    findById: (drinkId: string) =>
      Effect.provideService(
        findMenuItemById({ id: drinkId }).pipe(Effect.flatMap(decodeOptionalSqlMenuItem)),
        SqlClient.SqlClient,
        sqlClient,
      ),
    list,
  } as const;
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
