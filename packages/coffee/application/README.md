# Coffee Application

`@effect-coffee-shop/coffee-application` is a thin adapter layer over the
[`coffee-domain`](../domain) model for surfaces that do not speak the domain's
Apis directly (MCP tools, REST). It holds no business rules: those live in the
domain's aggregates, views, and policy.

- [`src/CoffeeOrderApp.ts`](./src/CoffeeOrderApp.ts): the `CoffeeOrderApp` service. It turns
  requests into commands sent to the `Order`, `Cart`, and `Customer` aggregates, reads the
  `OrderSummary`, `CustomerOrders`, and `OrderQueue` views, and translates domain rejections into
  application errors. `CoffeeOrderApp.layer` requires the `CoffeeShop` model's Layer.
- [`src/contracts.ts`](./src/contracts.ts): MCP/REST view schemas built from domain types.
- [`src/CurrentActor.ts`](./src/CurrentActor.ts): `AppActor`, the domain `Actor` plus an
  anonymous caller.
- [`src/errors.ts`](./src/errors.ts): adapter errors with their HTTP statuses.
- [`src/observability.ts`](./src/observability.ts): spans and metrics for application actions.

It depends only on `coffee-domain`, `alchemy`, and `effect`; domain never depends on application.
Import modules by path, e.g. `@effect-coffee-shop/coffee-application/CoffeeOrderApp`.
`CoffeeOrderApp` is tested over `Domain.InMemory` in
[`coffee-server`](../server/test/CoffeeApis.test.ts).

Run `typecheck`, `lint`, `lint:custom`, and `fmt:check` with
`bun run --cwd packages/coffee/application <task>`.
