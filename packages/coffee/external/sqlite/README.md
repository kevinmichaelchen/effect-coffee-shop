# SQLite External Layer

`@effect-coffee-shop/coffee-external-sqlite` provides SQLite and D1
implementations of the Coffee application ports.

The SQL definitions, generated queries, and migrations live under
[`src/sql`](./src/sql). Runtime-specific layers adapt Bun SQLite or Cloudflare
D1 into the shared SQL repository layer.

See [`coffee-core`](../../core) for the ports implemented by this package.

## Exports

| Name                                                            | Description                                        |
| --------------------------------------------------------------- | -------------------------------------------------- |
| [`SqlCoffeeAppLive`](./src/bun/live.ts)                         | Bun SQLite Coffee application layer.               |
| [`SqlCoffeeRepositoriesLive`](./src/sql/live.ts)                | Shared SQL-backed Coffee repositories and cart.    |
| [`makeCloudflareCoffeeAppLive`](./src/cloudflare/live.ts)       | Builds the Cloudflare D1 Coffee application layer. |
| [`makeCloudflareSqlCoffeeSchemaLive`](./src/cloudflare/live.ts) | Builds the Cloudflare D1 schema readiness layer.   |

## Commands

```bash
bun run --cwd packages/coffee/external/sqlite db:check
bun run --cwd packages/coffee/external/sqlite db:generate
bun run --cwd packages/coffee/external/sqlite db:migrate
bun run --cwd packages/coffee/external/sqlite typecheck
bun run --cwd packages/coffee/external/sqlite lint
bun run --cwd packages/coffee/external/sqlite lint:custom
bun run --cwd packages/coffee/external/sqlite fmt:check
bun run --cwd packages/coffee/external/sqlite test
```
