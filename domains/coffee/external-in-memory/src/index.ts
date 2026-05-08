import * as Layer from "effect/Layer";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
export { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
export { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export const InMemoryCoffeeRepositoriesLive = Layer.mergeAll(
  InMemoryMenuRepositoryLive,
  InMemoryOrderRepositoryLive,
);

export const CoffeeAppLive = Layer.mergeAll(
  InMemoryCoffeeRepositoriesLive,
  InMemoryOrderIdGeneratorLive,
);
