# Coffee Application

`@effect-coffee-shop/coffee-application` owns Effect use cases, the CoffeeOrderApp
service, ports, actors, boundary contracts, application errors, and observability.
It depends on [`coffee-domain`](../domain); domain never depends on application.
Import modules such as `@effect-coffee-shop/coffee-application/CoffeeOrderApp`
and `@effect-coffee-shop/coffee-application/ports/OrderRepository`.

Transport, auth, database, and runtime implementations remain in their respective
packages. Shared repository contract tests live in [`coffee-testing`](../testing).

Run `typecheck`, `lint`, `lint:custom`, `fmt:check`, and `test` with
`bun run --cwd packages/coffee/application <task>`.
