import * as Layer from "effect/Layer";
import { InMemoryEmailServiceLive } from "./in-memory/InMemoryEmailService.ts";
import { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export const InMemoryCoffeeRepositoriesLive = Layer.mergeAll(
  InMemoryMenuRepositoryLive,
  InMemoryOrderRepositoryLive,
);

export const InMemoryCoffeeAppLive = Layer.mergeAll(
  InMemoryCoffeeRepositoriesLive,
  InMemoryOrderIdGeneratorLive,
  InMemoryEmailServiceLive,
);

export { SqlCoffeeAppLive, SqlCoffeeRepositoriesLive } from "./sql/live.ts";
