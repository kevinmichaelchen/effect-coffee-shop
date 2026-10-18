/**
 * Applies the checked-in auth `migrations/*.sql` files to an empty D1 binding
 * in tests. Deploys apply the same directory through Alchemy, which records
 * each file in `d1_migrations`; this runner keeps that history shape.
 *
 * Statements are split on a `;` that ends a line, so every statement in a
 * migration file must end that way. D1 has no transactions, and batches do
 * not survive Alchemy's local platform proxy, so statements apply in order.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Str from "effect/String";
import { SqlClient } from "effect/sql";
import type { D1Database } from "@cloudflare/workers-types";
import { D1Client } from "@effect/sql-d1";

class SqlMigrationError extends Schema.TaggedError<SqlMigrationError>()("SqlMigrationError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect()),
}) {}

type SqlMigration = {
  readonly name: string;
  readonly statements: ReadonlyArray<string>;
};

const migrationFileName = /^\d+_[\w-]+\.sql$/;

const AppliedMigrations = Schema.Array(Schema.Struct({ name: Schema.String }));
const decodeAppliedMigrations = Schema.decodeUnknownEffect(AppliedMigrations);

const splitStatements = (content: string) =>
  content
    .split(/;[ \t]*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Str.isNonEmpty);

const migrationFailure = (message: string) => (cause: unknown) =>
  new SqlMigrationError({ message, cause });

const loadMigrations = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* path.fromFileUrl(new URL("../../migrations", import.meta.url));
  const files = yield* fs.readDirectory(directory);

  return yield* Effect.forEach(
    Arr.sort(
      files.filter((file) => migrationFileName.test(file)),
      Order.String,
    ),
    (name) =>
      fs
        .readFileString(path.join(directory, name))
        .pipe(
          Effect.map((content): SqlMigration => ({ name, statements: splitStatements(content) })),
        ),
    { concurrency: 1 },
  );
}).pipe(Effect.mapError(migrationFailure("Failed to read SQL migrations")));

const pendingMigrations = (
  migrations: ReadonlyArray<SqlMigration>,
  applied: ReadonlyArray<string>,
) =>
  Arr.every(applied, (name, index) => migrations[index]?.name === name)
    ? Effect.succeed(migrations.slice(applied.length))
    : Effect.fail(
        new SqlMigrationError({
          message: `Applied migration history [${applied.join(", ")}] is not a prefix of the checked-in migrations`,
        }),
      );

const migrateSqlDatabase = Effect.fn("CoffeeAuth.migrate")(function* () {
  const sql = yield* SqlClient.SqlClient;
  const migrations = yield* loadMigrations;

  const applied = yield* sql`
    create table if not exists d1_migrations (
      id text primary key,
      name text not null,
      applied_at text not null
    )
  `.pipe(
    Effect.andThen(sql`select name from d1_migrations order by id`),
    Effect.flatMap(decodeAppliedMigrations),
    Effect.mapError(migrationFailure("Failed to read applied SQL migrations")),
  );
  const pending = yield* pendingMigrations(
    migrations,
    applied.map((row) => row.name),
  );

  const applyMigration = (migration: SqlMigration) =>
    Effect.forEach(
      [
        ...migration.statements.map((statement) => sql.unsafe(statement)),
        sql`
          insert into d1_migrations (id, name, applied_at)
          values (
            printf('%05d', (select coalesce(max(cast(id as integer)), 0) + 1 from d1_migrations)),
            ${migration.name},
            datetime('now')
          )
        `,
      ],
      (statement) => statement,
      { concurrency: 1, discard: true },
    );

  yield* Effect.forEach(
    pending,
    (migration) =>
      applyMigration(migration).pipe(
        Effect.mapError(migrationFailure(`Failed to apply SQL migration "${migration.name}"`)),
      ),
    { concurrency: 1, discard: true },
  );
});

/** Migrate an empty D1 binding; provide `FileSystem` and `Path` to read the files. */
export const migrateCloudflareD1 = (db: D1Database) =>
  migrateSqlDatabase().pipe(Effect.provide(D1Client.layer({ db })));
