import * as Layer from "effect/Layer";
import { InMemoryCartItemIdGeneratorLive } from "./in-memory/InMemoryCartItemIdGenerator.ts";
import { InMemoryCartRepositoryLive } from "./in-memory/InMemoryCartRepository.ts";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";
import { InMemoryPendingOrderConfirmationRepositoryLive } from "./in-memory/InMemoryPendingOrderConfirmationRepository.ts";

export { InMemoryCartItemIdGeneratorLive } from "./in-memory/InMemoryCartItemIdGenerator.ts";
export { InMemoryCartRepositoryLive } from "./in-memory/InMemoryCartRepository.ts";
export { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
export { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
export { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";
export { InMemoryPendingOrderConfirmationRepositoryLive } from "./in-memory/InMemoryPendingOrderConfirmationRepository.ts";

export const InMemoryCoffeeRepositoriesLive = Layer.mergeAll(
  InMemoryCartRepositoryLive,
  InMemoryMenuRepositoryLive,
  InMemoryOrderRepositoryLive,
  InMemoryPendingOrderConfirmationRepositoryLive,
);

export const CoffeeAppLive = Layer.mergeAll(
  InMemoryCoffeeRepositoriesLive,
  InMemoryCartItemIdGeneratorLive,
  InMemoryOrderIdGeneratorLive,
);
