import * as Layer from "effect/Layer";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export const InMemoryCoffeeAppLive = Layer.mergeAll(
  InMemoryMenuRepositoryLive,
  InMemoryOrderRepositoryLive,
);
