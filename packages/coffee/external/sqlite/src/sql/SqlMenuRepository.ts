/**
 * Reads the static Coffee menu through the SQL repository port.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/sql";
import type * as SqlConnection from "effect/sql/SqlConnection";
import type { MenuItem } from "@effect-coffee-shop/coffee-domain/menu";
import { PersistenceError } from "@effect-coffee-shop/coffee-application/errors";
import { MenuRepository } from "@effect-coffee-shop/coffee-application/ports/MenuRepository";
import { findMenuItemById, listMenuItems } from "./queries/menu.ts";
import { SqlMenuItemModel, toMenuItem } from "./models.ts";

const decodeSqlMenuItems = Schema.decodeUnknownEffect(Schema.Array(SqlMenuItemModel));
const decodeSqlMenuItem = Schema.decodeUnknownEffect(SqlMenuItemModel);

const decodeOptionalSqlMenuItem = (row: Option.Option<SqlConnection.Row>) =>
  Option.match(row, {
    onNone: () => Effect.succeed(Option.none<MenuItem>()),
    onSome: (row) =>
      decodeSqlMenuItem(row).pipe(Effect.flatMap(toMenuItem), Effect.map(Option.some)),
  });

const makeSqlMenuQueries = Effect.fn("SqlMenuRepository.makeSqlMenuQueries")(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const list = Effect.provideService(
    listMenuItems().pipe(
      Effect.flatMap(decodeSqlMenuItems),
      Effect.flatMap((items) => Effect.forEach(items, toMenuItem, { concurrency: 1 })),
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
    const queries = yield* makeSqlMenuQueries();

    return MenuRepository.of({
      list: queries.list.pipe(PersistenceError.refail("Failed to load the coffee menu")),
      findById: (drinkId) =>
        queries
          .findById(drinkId)
          .pipe(PersistenceError.refail(`Failed to load menu item "${drinkId}"`)),
    });
  }),
);
