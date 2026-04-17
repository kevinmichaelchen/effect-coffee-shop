import * as Layer from "effect/Layer";
import { InMemoryOrderIdGeneratorLive } from "../in-memory/InMemoryOrderIdGenerator.ts";
import { SqlMenuRepositoryLive } from "./SqlMenuRepository.ts";
import { SqlOrderRepositoryLive } from "./SqlOrderRepository.ts";
import { SqlCoffeeBootstrapLive } from "./bootstrap.ts";

export const SqlCoffeeRepositoriesLive = Layer.mergeAll(
  SqlCoffeeBootstrapLive,
  SqlMenuRepositoryLive,
  SqlOrderRepositoryLive,
);

export const SqlCoffeeAppLive = Layer.mergeAll(
  SqlCoffeeRepositoriesLive,
  InMemoryOrderIdGeneratorLive,
);
