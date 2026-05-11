import * as Layer from "effect/Layer";
import { SqlCartItemIdGeneratorLive } from "./CartItemIdGenerator.ts";
import { SqlCheckoutSessionIdGeneratorLive } from "./CheckoutSessionIdGenerator.ts";
import { SqlOrderIdGeneratorLive } from "./OrderIdGenerator.ts";
import { SqlCartRepositoryLive } from "./SqlCartRepository.ts";
import { SqlCheckoutSessionRepositoryLive } from "./SqlCheckoutSessionRepository.ts";
import { SqlMenuRepositoryLive } from "./SqlMenuRepository.ts";
import { SqlOrderRepositoryLive } from "./SqlOrderRepository.ts";
import { SqlCoffeePersistenceLive } from "./persistence.ts";

export const SqlCoffeeRepositoriesLive = Layer.mergeAll(
  SqlCoffeePersistenceLive,
  SqlCartRepositoryLive,
  SqlCheckoutSessionRepositoryLive,
  SqlMenuRepositoryLive,
  SqlOrderRepositoryLive,
);

export const SqlCoffeeAppLive = Layer.mergeAll(
  SqlCoffeeRepositoriesLive,
  SqlCartItemIdGeneratorLive,
  SqlCheckoutSessionIdGeneratorLive,
  SqlOrderIdGeneratorLive,
);
