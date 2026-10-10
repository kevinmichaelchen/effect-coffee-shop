# SQL Infrastructure

This directory is the External/Infrastructure implementation for SQL-backed
repository ports. Domain and service code should not import database clients,
SQL queries, or migration tooling from here.

Effect SQL owns runtime execution, layers, transactions, and resource
management. There is no code generator: queries and migrations are written and
reviewed by hand.

```text
packages/coffee/external/sqlite/src/sql/
  migrate.ts
  migrations/
    0000_initial_coffee_schema.sql
    ...
  queries/
    carts.ts
    checkout-sessions.ts
    menu.ts
    orders.ts
```

## Intended Boundaries

- `migrations/*.sql` is reviewed schema history.
- `queries/*.ts` is the query surface, one module per aggregate.
- `SqlMenuRepository`, `SqlCartRepository`, `SqlCheckoutSessionRepository`,
  and `SqlOrderRepository` remain the service-port adapters. They decode query
  rows with `effect/Schema` into infrastructure models before mapping them to
  domain values.
- Domain and service layers keep depending only on ports such as
  `MenuRepository` and `OrderRepository`.

## Query Design

Write each query as an Effect SQL tagged template (`` sql`...` ``) so values
stay bound parameters. The `no-raw-sqlite-unsafe` custom lint rule rejects
`sqlClient.unsafe` everywhere in this directory except `migrate.ts`.

For optional list filters, prefer a small set of named queries over dynamic SQL
construction. That keeps stable query names for tracing spans.

Query results are untyped rows. Do not treat them as validated data; repository
adapters decode them before use.

## Migration Workflow

Add a new numbered file to `migrations/` for every schema change. Never edit or
delete a migration once it has been applied anywhere.

- Cloudflare D1: the Alchemy `Cloudflare.D1.Database` resource in
  `infra/alchemy/cloudflare.ts` applies this directory at deploy time.
- Bun SQLite: `BunCoffeeAppLive` applies pending migrations on startup.
- Tests: `migrateCloudflareD1` applies them to an empty D1 binding.

`migrate.ts` records applied files in the same `d1_migrations` table that
Alchemy and Wrangler use. It splits files on a `;` at the end of a line, so end
every statement that way. On Bun SQLite each migration runs in a transaction.
D1 has no transactions, and batches do not survive Alchemy's local platform
proxy, so D1 applies statements in order.

## Authentication schema

Yielded's table mappings live in `packages/coffee/auth/src/persistence/`.
`0004_yielded_auth.sql` creates their tables and removes the old prototype auth
and Agent Auth tables. Historical migrations remain unchanged. Keep SQLite and
PostgreSQL migrations aligned with these mappings; auth HTTP handlers never run
schema alterations.
