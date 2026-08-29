/**
 * Adapts the Coffee HTTP API into a Web Fetch handler.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";

export interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request, services?: Context.Context<unknown>) => Promise<Response>;
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
      Layer.provide(HttpObservabilityLive),
    ),
    {
      disableLogger: true,
    },
  );

  return {
    dispose,
    handler: (request: Request, services = emptyWebHandlerServices()) => handler(request, services),
  };
}
