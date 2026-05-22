import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { HostObservabilityLive } from "@effect-coffee-shop/backend-host/observability";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  normalizeMcpHttpRequestIds,
  restoreMcpHttpResponseIds,
} from "@effect-coffee-shop/backend-host/http-jsonrpc-ids";

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
      Layer.provide(HostObservabilityLive),
    ),
    {
      disableLogger: true,
    },
  );

  return {
    dispose,
    handler: async (request: Request, services = emptyWebHandlerServices()) => {
      const normalized = await normalizeMcpHttpRequestIds(request);
      const response = await handler(normalized.request, services);
      return restoreMcpHttpResponseIds(response, normalized.surrogateIdMap);
    },
  };
}
