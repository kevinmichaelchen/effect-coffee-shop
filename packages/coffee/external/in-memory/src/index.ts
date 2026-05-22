/**
 * Public exports and layers for in-memory Coffee repositories.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { InMemoryCartItemIdGeneratorLive } from "./in-memory/InMemoryCartItemIdGenerator.ts";
import { InMemoryCartRepositoryLive } from "./in-memory/InMemoryCartRepository.ts";
import { InMemoryCheckoutSessionIdGeneratorLive } from "./in-memory/InMemoryCheckoutSessionIdGenerator.ts";
import { InMemoryCheckoutSessionRepositoryLive } from "./in-memory/InMemoryCheckoutSessionRepository.ts";
import { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
import { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
import { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export { InMemoryCartItemIdGeneratorLive } from "./in-memory/InMemoryCartItemIdGenerator.ts";
export { InMemoryCartRepositoryLive } from "./in-memory/InMemoryCartRepository.ts";
export { InMemoryCheckoutSessionIdGeneratorLive } from "./in-memory/InMemoryCheckoutSessionIdGenerator.ts";
export { InMemoryCheckoutSessionRepositoryLive } from "./in-memory/InMemoryCheckoutSessionRepository.ts";
export { InMemoryMenuRepositoryLive } from "./in-memory/InMemoryMenuRepository.ts";
export { InMemoryOrderIdGeneratorLive } from "./in-memory/InMemoryOrderIdGenerator.ts";
export { InMemoryOrderRepositoryLive } from "./in-memory/InMemoryOrderRepository.ts";

export const InMemoryCoffeeRepositoriesLive = Layer.mergeAll(
  InMemoryCartRepositoryLive,
  InMemoryCheckoutSessionRepositoryLive,
  InMemoryMenuRepositoryLive,
  InMemoryOrderRepositoryLive,
);

export const CoffeeAppLive = Layer.mergeAll(
  InMemoryCoffeeRepositoriesLive,
  InMemoryCartItemIdGeneratorLive,
  InMemoryCheckoutSessionIdGeneratorLive,
  InMemoryOrderIdGeneratorLive,
);
