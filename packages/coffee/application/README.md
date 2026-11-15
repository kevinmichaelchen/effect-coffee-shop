# Coffee Application

`@effect-coffee-shop/coffee-application` serves the hand-written MCP surface from the
[`coffee-domain`](../domain) model: the static menu, item options, order quotes and order reads. It
holds no business rules and sends no commands; orders, carts and the staff lifecycle go through the
domain Apis.

<details>
<summary>What lives where</summary>

- [`src/CoffeeOrderApp.ts`](./src/CoffeeOrderApp.ts): the `CoffeeOrderApp` service. It reads
  `OrderSummary`, `CustomerOrders` and `OrderQueue`, prices orders with the domain's pure pricing
  functions, and translates domain rejections into application errors. It checks the signed-in actor
  before every read and narrows a customer to their own orders. `CoffeeOrderApp.layer` takes the
  views from whatever model Layer its caller provides.
- [`src/contracts.ts`](./src/contracts.ts): MCP/REST view schemas built from domain types.
- [`src/CurrentActor.ts`](./src/CurrentActor.ts): `AppActor`, the domain `Actor` plus an anonymous
  caller.
- [`src/errors.ts`](./src/errors.ts): adapter errors with their HTTP statuses.
- [`src/observability.ts`](./src/observability.ts): spans and metrics for application actions.

It depends only on `coffee-domain`, `alchemy`, and `effect`; domain never depends on application.
Import modules by path, e.g. `@effect-coffee-shop/coffee-application/CoffeeOrderApp`.
`CoffeeOrderApp` is tested over `Domain.InMemory` in
[`coffee-server`](../server/test/CoffeeApis.test.ts).

```bash
bun run --cwd packages/coffee/application typecheck
bun run --cwd packages/coffee/application lint
bun run --cwd packages/coffee/application fmt:check
```

</details>
