import * as Layer from "effect/Layer";
import { InMemoryEmailServiceLive } from "../in-memory/InMemoryEmailService.ts";
import { InMemoryOrderIdGeneratorLive } from "../in-memory/InMemoryOrderIdGenerator.ts";
import { SqlMenuRepositoryLive } from "./SqlMenuRepository.ts";
import { SqlOrderRepositoryLive } from "./SqlOrderRepository.ts";
import { SqlCoffeePersistenceLive } from "./persistence.ts";

export const SqlCoffeeRepositoriesLive = Layer.mergeAll(
  SqlCoffeePersistenceLive,
  SqlMenuRepositoryLive,
  SqlOrderRepositoryLive,
);

export const SqlCoffeeCoreLive = Layer.mergeAll(
  SqlCoffeeRepositoriesLive,
  InMemoryOrderIdGeneratorLive,
);

export const SqlCoffeeAppLive = Layer.mergeAll(SqlCoffeeCoreLive, InMemoryEmailServiceLive);
