import * as Layer from "effect/Layer";
import { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export const InMemoryCoffeeAppLive = Layer.mergeAll(
  InMemoryMenuRepositoryLive,
  InMemoryOrderIdGeneratorLive,
  InMemoryOrderRepositoryLive,
);
