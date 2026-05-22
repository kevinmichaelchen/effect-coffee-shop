# In-Memory External Layer

`@effect-coffee-shop/coffee-external-in-memory` provides in-memory
implementations of the Coffee application ports.

It is useful for local development, tests, and adapter contracts that do not
need durable storage. The composition root chooses whether to use this package
or a durable external layer.

See [`coffee-core`](../../core) for the ports implemented by this package.

## Exports

| Name                                                                                | Description                                      |
| ----------------------------------------------------------------------------------- | ------------------------------------------------ |
| [`CoffeeAppLive`](./src/index.ts)                                                   | Complete in-memory Coffee application layer.     |
| [`InMemoryCoffeeRepositoriesLive`](./src/index.ts)                                  | Combined in-memory Coffee repositories.          |
| [`InMemoryCartRepositoryLive`](./src/in-memory/InMemoryCartRepository.ts)           | In-memory cart repository implementation.        |
| [`InMemoryCartItemIdGeneratorLive`](./src/in-memory/InMemoryCartItemIdGenerator.ts) | In-memory cart item ID generator implementation. |
| [`InMemoryMenuRepositoryLive`](./src/in-memory/InMemoryMenuRepository.ts)           | In-memory menu repository implementation.        |
| [`InMemoryOrderRepositoryLive`](./src/in-memory/InMemoryOrderRepository.ts)         | In-memory order repository implementation.       |
| [`InMemoryOrderIdGeneratorLive`](./src/in-memory/InMemoryOrderIdGenerator.ts)       | In-memory order ID generator implementation.     |

## Commands

```bash
bun run --cwd packages/coffee/external/in-memory typecheck
bun run --cwd packages/coffee/external/in-memory lint
bun run --cwd packages/coffee/external/in-memory lint:custom
bun run --cwd packages/coffee/external/in-memory fmt:check
bun run --cwd packages/coffee/external/in-memory test
```
