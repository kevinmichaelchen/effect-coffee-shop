import * as Layer from "effect/Layer";
import { SqlOrderIdGeneratorLive } from "./OrderIdGenerator.ts";
import { SqlMenuRepositoryLive } from "./SqlMenuRepository.ts";
import { SqlOrderRepositoryLive } from "./SqlOrderRepository.ts";
import { SqlCoffeePersistenceLive } from "./persistence.ts";

export const SqlCoffeeRepositoriesLive = Layer.mergeAll(
  SqlCoffeePersistenceLive,
  SqlMenuRepositoryLive,
  SqlOrderRepositoryLive,
);

export const SqlCoffeeAppLive = Layer.mergeAll(SqlCoffeeRepositoriesLive, SqlOrderIdGeneratorLive);
