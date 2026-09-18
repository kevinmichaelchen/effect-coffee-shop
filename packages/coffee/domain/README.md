# Coffee Domain

`@effect-coffee-shop/coffee-domain` owns pure Coffee concepts: money, menu items,
orders, carts, checkout sessions, typed IDs, and domain errors. Import individual
modules such as `@effect-coffee-shop/coffee-domain/order`.

This package has no workspace dependencies. Application workflows, persistence,
transport contracts, and runtime wiring belong outside this boundary.

Run `typecheck`, `lint`, `lint:custom`, `fmt:check`, and `test` with
`bun run --cwd packages/coffee/domain <task>`.
