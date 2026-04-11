import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import {
  normalizeMcpHttpRequestIds,
  restoreMcpHttpResponseIds,
} from "#presentation/mcp/http-jsonrpc-ids";

interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request) => Promise<Response>;
}

const UnusedWebHandlerService = ServiceMap.Service<unknown>(
  "presentation/http/UnusedWebHandlerService",
);

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
    handler: async (request: Request) => {
      const normalized = await normalizeMcpHttpRequestIds(request);
      const services = ServiceMap.make(UnusedWebHandlerService, undefined);
      const response = await handler(normalized.request, services);
      return restoreMcpHttpResponseIds(response, normalized.surrogateIdMap);
    },
  };
}
