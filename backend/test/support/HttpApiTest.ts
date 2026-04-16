import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { InMemoryCoffeeAppLive } from "#external/live";
import { InMemoryEmailServiceLive } from "#external/in-memory/InMemoryEmailService";
import { InMemoryOrderIdGeneratorLive } from "#external/in-memory/InMemoryOrderIdGenerator";
import { InMemoryOrderRepositoryLive } from "#external/in-memory/InMemoryOrderRepository";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CurrentActor, systemActor } from "#service/CurrentActor";
import { PersistenceError } from "#service/errors";
import { MenuRepository } from "#service/ports/MenuRepository";

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
      InMemoryEmailServiceLive,
    ),
  ),
  Layer.provideMerge(NodeHttpServer.layerTest),
);
