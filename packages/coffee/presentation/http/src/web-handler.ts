/**
 * Adapts the Coffee HTTP API into a Web Fetch handler.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";

export interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request, services?: Context.Context<unknown>) => Promise<Response>;
}

export type CoffeeAppLayer = Layer.Layer<Layer.Services<typeof CoffeeOrderApp.layer>, unknown>;
export type CoffeeRoutesLayer = Layer.Layer<
  never,
  unknown,
  | Layer.Services<typeof CoffeeOrderApp.layer>
  | Layer.Success<typeof HttpServer.layerServices>
  | CoffeeOrderApp
  | HttpRouter.HttpRouter
  | HttpRouter.Request<"Requires", unknown>
  | HttpRouter.Request<"Error", unknown>
>;

export function createCoffeeWebHandler(
  routes: CoffeeRoutesLayer,
  appLayer: CoffeeAppLayer,
): CoffeeWebHandler {
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
