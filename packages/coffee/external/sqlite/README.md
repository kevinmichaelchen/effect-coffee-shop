# SQLite External Layer

`@effect-coffee-shop/coffee-external-sqlite` provides SQLite and D1
implementations of the Coffee application ports.

The SQL definitions, generated queries, and migrations live under
[`src/sql`](./src/sql). Runtime-specific layers adapt Bun SQLite or Cloudflare
D1 into the shared SQL repository layer.

## Exports

| Name                                | Description                                        |
| ----------------------------------- | -------------------------------------------------- |
| `SqlCoffeeAppLive`                  | Bun SQLite Coffee application layer.               |
| `SqlCoffeeRepositoriesLive`         | Shared SQL-backed Coffee repositories and cart.    |
| `makeCloudflareCoffeeAppLive`       | Builds the Cloudflare D1 Coffee application layer. |
| `makeCloudflareSqlCoffeeSchemaLive` | Builds the Cloudflare D1 schema readiness layer.   |

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
