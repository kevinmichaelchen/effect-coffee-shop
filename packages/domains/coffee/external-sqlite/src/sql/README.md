# SQL Infrastructure

This directory is the External/Infrastructure implementation for SQL-backed
repository ports. Domain and service code should not import database clients,
SQL query wrappers, generated files, or migration tooling from here.

## SQLFU Project

SQLFU is used here as a SQL-first infrastructure tool, not as an inner layer
abstraction. It owns authored SQL artifacts while Effect SQL continues to own
runtime execution, layers, transactions, and resource management.

The project shape is:

```text
packages/domains/coffee/external-sqlite/src/sql/
  sqlfu.config.ts
  definitions.sql
  migrations/
    .generated/
  queries/
    find-menu-item-by-id.sql
    list-menu-items.sql
    save-order.sql
    ...
    .generated/
```

The config uses SQLFU's Effect v4 generation target:

```ts
import { defineConfig } from "sqlfu";

export default defineConfig({
  definitions: "./definitions.sql",
  migrations: { path: "./migrations", preset: "d1" },
  queries: "./queries",
  generate: {
    runtime: "effect-v4-unstable",
  },
});
```

`runtime: "effect-v4-unstable"` makes generated query functions return
`Effect` values and read `SqlClient.SqlClient` from the Effect environment.
That matches the current Bun and Cloudflare runtime layers, which already
provide `effect/unstable/sql` clients.

## Intended Boundaries

- `definitions.sql` is the desired infrastructure schema.
- `migrations/*.sql` is reviewed schema history.
- `queries/*.sql` is the authored query surface.
- `queries/.generated/*.ts` is generated adapter code and should not be
  edited by hand.
- `SqlMenuRepository` and `SqlOrderRepository` remain the service-port
  adapters. They translate generated query results into domain values.
- Domain and service layers keep depending only on ports such as
  `MenuRepository` and `OrderRepository`.

Generated SQLFU types should not replace boundary decoding. SQLFU's Effect
runtime does not currently compose with `generate.validator`, and this codebase
prefers `effect/Schema` at external boundaries. Repository adapters should still
decode rows into infrastructure models before mapping them to domain values.

## Migration Workflow

Use SQLFU for schema changes instead of runtime schema patches:

```sh
bun run --cwd apps/backend db:check
bun run --cwd apps/backend db:draft
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```

Those backend scripts delegate to the `@effect-coffee-shop/coffee-external-sqlite`
workspace so SQLFU config, migrations, queries, and generated wrappers stay
owned by the SQLite/D1 External Layer package.

`check` should be the default diagnostic command. `draft` should create
reviewable migrations from `definitions.sql`. `migrate` should apply reviewed
migrations to the configured development or deployment database.

For Cloudflare D1, the config uses SQLFU's `d1` migration preset so migration
history lines up with D1-compatible tooling. Runtime-specific layers adapt the
Bun SQLite and Cloudflare D1 bindings into SQLFU clients before the repository
layers seed or query data.

## Query Design

Prefer checked-in named query files over inline SQL strings. For example:

- `list-menu-items.sql`
- `find-menu-item-by-id.sql`
- `save-order.sql`
- `find-order-by-id.sql`
- `list-orders.sql`
- `list-orders-by-owner.sql`
- `list-orders-by-status.sql`
- `list-orders-by-owner-and-status.sql`
- `seed-menu-item.sql`

For optional list filters, prefer a small set of named queries over dynamic SQL
construction. That preserves stable query names for generated functions,
observability, and freshness checks.

Order persistence uses a single SQLite upsert with `returning`. If SQLFU's
analyzer stops accepting that shape in a future release, keep separate insert
and update query files rather than hand-editing generated output.

## Better Auth Schema

SQLFU's Better Auth integration owns the auth-managed region of
`definitions.sql`. Better Auth remains the source for auth table shape while
SQLFU remains the migration owner.

The workflow is:

```sh
bun run --cwd apps/backend db:auth:schema
bun run --cwd apps/backend db:draft
bun run --cwd apps/backend db:generate
bun run --cwd apps/backend db:migrate
```

Presentation code must not run Better Auth schema migrations or compatibility
`alter table` patches at request time.

Better Auth runtime behavior can continue using the current D1-backed adapter
until there is a separate reason to change it.

## What To Avoid

- Do not import SQLFU generated code from domain, service, or presentation
  logic.
- Do not treat generated TypeScript row types as validated domain data.
- Do not hand-edit `queries/.generated` files.
- Do not use `sqlfu sync` for production-style schema changes. It updates live
  schema without preserving migration history.
- Do not move Better Auth runtime ownership at the same time as schema
  ownership. Split those changes so failures are easy to isolate.
- Do not adopt SQLFU's outbox module yet. It is experimental and overlaps with
  a different architectural decision than SQL authoring and migrations.
