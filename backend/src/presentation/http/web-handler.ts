import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";

interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

export function createCoffeeWebHandler<
  TRoutes extends Layer.Layer<never, any, any>,
  TAppLayer extends Layer.Layer<never, any, any>,
>(routes: TRoutes, appLayer: TAppLayer): CoffeeWebHandler {
  const { dispose, handler } = HttpRouter.toWebHandler(
    routes.pipe(
      Layer.provide(CoffeeOrderApp.layer),
      Layer.provide(appLayer),
      Layer.provide(HttpServer.layerServices),
    ),
    {
      disableLogger: true,
    },
  );

  return {
    dispose,
    handler: async (request: Request) =>
      handler(request, ServiceMap.empty() as ServiceMap.ServiceMap<unknown>),
  };
}
