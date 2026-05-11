import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import {
  CoffeeAppLive as InMemoryCoffeeAppLive,
  InMemoryCheckoutSessionIdGeneratorLive,
  InMemoryCheckoutSessionRepositoryLive,
  InMemoryMenuRepositoryLive,
} from "@effect-coffee-shop/coffee-external-in-memory";
import { InMemoryCartItemIdGeneratorLive } from "@effect-coffee-shop/coffee-external-in-memory/in-memory/InMemoryCartItemIdGenerator";
import { InMemoryCartRepositoryLive } from "@effect-coffee-shop/coffee-external-in-memory/in-memory/InMemoryCartRepository";
import { InMemoryOrderIdGeneratorLive } from "@effect-coffee-shop/coffee-external-in-memory/in-memory/InMemoryOrderIdGenerator";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { CoffeeHttpApiLive } from "./api.ts";

export const HttpApiTestLive = HttpRouter.serve(CoffeeHttpApiLive, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
  Layer.provide(CoffeeOrderApp.layer),
  Layer.provide(InMemoryCoffeeAppLive),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const FailingOrderRepositoryLive = Layer.succeed(OrderRepository)({
  save: () => Effect.fail(new PersistenceError({ message: "Failed to save the coffee order" })),
  getById: () => Effect.fail(new PersistenceError({ message: "Failed to load the coffee order" })),
  list: () => Effect.fail(new PersistenceError({ message: "Failed to list coffee orders" })),
});

export const HttpApiPersistenceFailureTestLive = HttpRouter.serve(CoffeeHttpApiLive, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
  Layer.provide(CoffeeOrderApp.layer),
  Layer.provide(
    Layer.mergeAll(
      FailingOrderRepositoryLive,
      InMemoryCartItemIdGeneratorLive,
      InMemoryCartRepositoryLive,
      InMemoryCheckoutSessionIdGeneratorLive,
      InMemoryCheckoutSessionRepositoryLive,
      InMemoryMenuRepositoryLive,
      InMemoryOrderIdGeneratorLive,
    ),
  ),
  Layer.provideMerge(NodeHttpServer.layerTest),
);
