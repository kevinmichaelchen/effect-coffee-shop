# In-Memory External Layer

`@effect-coffee-shop/coffee-external-in-memory` provides in-memory
implementations of the Coffee application ports.

It is useful for local development, tests, and adapter contracts that do not
need durable storage. The composition root chooses whether to use this package
or a durable external layer.

## Exports

| Name | Description |
| --- | --- |
| `CoffeeAppLive` | Complete in-memory Coffee application layer. |
| `InMemoryCoffeeRepositoriesLive` | Combined in-memory menu and order repositories. |
| `InMemoryMenuRepositoryLive` | In-memory menu repository implementation. |
| `InMemoryOrderRepositoryLive` | In-memory order repository implementation. |
| `InMemoryOrderIdGeneratorLive` | In-memory order ID generator implementation. |

## Commands

```bash
bun run --cwd packages/coffee/external/in-memory typecheck
bun run --cwd packages/coffee/external/in-memory lint
bun run --cwd packages/coffee/external/in-memory lint:custom
bun run --cwd packages/coffee/external/in-memory fmt:check
bun run --cwd packages/coffee/external/in-memory test
```
