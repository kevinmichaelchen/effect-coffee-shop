# Coffee Testing

`@effect-coffee-shop/coffee-testing` provides the shared repository contract harness.
Adapter tests import `@effect-coffee-shop/coffee-testing/repository-contract` and
provide implementations of the core repository ports. Declare this package as a
dev dependency; production code must not import it.

Run all adapter suites with:

```sh
bun run turbo run test --filter='@effect-coffee-shop/coffee-external-*'
```

The Postgres suite additionally requires `COFFEE_POSTGRES_TEST_URL`; see the
[Postgres adapter](../external/drizzle-postgres/README.md#contract-tests).
