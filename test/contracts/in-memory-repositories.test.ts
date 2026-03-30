import * as Effect from "effect/Effect";
import { InMemoryCoffeeRepositoriesLive } from "../../src/external/live.ts";
import type { MenuRepository } from "../../src/service/ports/MenuRepository.ts";
import type { OrderRepository } from "../../src/service/ports/OrderRepository.ts";
import { defineRepositoryContract } from "./repository-contract.ts";

const runInMemory = <A>(effect: Effect.Effect<A, never, MenuRepository | OrderRepository>) =>
  effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive));

defineRepositoryContract("in-memory repositories", runInMemory);
