# Drizzle Postgres External Layer

This package is a Postgres-backed External Layer implementation for the coffee
application ports. It is intentionally separate from
`@effect-coffee-shop/coffee-external-sqlite`; the composition root chooses one
adapter layer at runtime.

```ts
import { DrizzlePostgresCoffeeAppLive as CoffeeAppLive } from "@effect-coffee-shop/coffee-external-drizzle-postgres";
```

## Ownership

- Drizzle owns Postgres table definitions in `src/db/schema.ts`.
- `drizzle-kit` owns generated Postgres migrations in `src/db/migrations`.
- Runtime startup uses `drizzle-orm/effect-postgres/migrator`.
- Repository adapters still satisfy the centralized Application Layer ports:
  `MenuRepository`, `OrderRepository`, and `OrderIdGenerator`.
- Rows are decoded with `effect/Schema` before they are mapped into domain
  values.

## Commands

```sh
bun run --cwd packages/coffee/external/drizzle-postgres db:generate
bun run --cwd packages/coffee/external/drizzle-postgres db:migrate
```

`db:migrate` reads `COFFEE_POSTGRES_URL`. The same variable is used by the live
Effect layer.
