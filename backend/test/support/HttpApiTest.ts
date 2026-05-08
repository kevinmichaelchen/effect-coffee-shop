import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/external-in-memory";
import { InMemoryOrderIdGeneratorLive } from "@effect-coffee-shop/external-in-memory/in-memory/InMemoryOrderIdGenerator";
import { InMemoryOrderRepositoryLive } from "@effect-coffee-shop/external-in-memory/in-memory/InMemoryOrderRepository";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { CoffeeOrderApp } from "@effect-coffee-shop/core/service/CoffeeOrderApp";
import { CurrentActor, systemActor } from "@effect-coffee-shop/core/service/CurrentActor";
import { PersistenceError } from "@effect-coffee-shop/core/service/errors";
import { MenuRepository } from "@effect-coffee-shop/core/service/ports/MenuRepository";

export const HttpApiTestLive = HttpRouter.serve(CoffeeHttpApiLive, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
  Layer.provide(CoffeeOrderApp.layer),
  Layer.provide(InMemoryCoffeeAppLive),
  Layer.provideMerge(NodeHttpServer.layerTest),
);

const FailingMenuRepositoryLive = Layer.succeed(MenuRepository)({
  list: Effect.fail(new PersistenceError({ message: "Failed to load the coffee menu" })),
  findById: () =>
    Effect.fail(new PersistenceError({ message: 'Failed to load menu item "latte"' })),
});

export const HttpApiPersistenceFailureTestLive = HttpRouter.serve(CoffeeHttpApiLive, {
  disableListenLog: true,
  disableLogger: true,
}).pipe(
  Layer.provide(Layer.succeed(CurrentActor)(systemActor)),
  Layer.provide(CoffeeOrderApp.layer),
  Layer.provide(
    Layer.mergeAll(
      FailingMenuRepositoryLive,
      InMemoryOrderRepositoryLive,
      InMemoryOrderIdGeneratorLive,
    ),
  ),
  Layer.provideMerge(NodeHttpServer.layerTest),
);
