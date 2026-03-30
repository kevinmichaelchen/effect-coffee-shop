import * as Effect from "effect/Effect";
import { InMemoryCoffeeRepositoriesLive } from "#external/live";
import type { MenuRepository } from "#service/ports/MenuRepository";
import type { OrderRepository } from "#service/ports/OrderRepository";
import { defineRepositoryContract } from "./repository-contract.ts";

const runInMemory = <A>(effect: Effect.Effect<A, never, MenuRepository | OrderRepository>) =>
  effect.pipe(Effect.provide(InMemoryCoffeeRepositoriesLive));

defineRepositoryContract("in-memory repositories", runInMemory);
