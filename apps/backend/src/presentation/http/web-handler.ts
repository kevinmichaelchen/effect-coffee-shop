import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/service/CoffeeOrderApp";
import {
  normalizeMcpHttpRequestIds,
  restoreMcpHttpResponseIds,
} from "#presentation/mcp/http-jsonrpc-ids";

interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request, services?: Context.Context<unknown>) => Promise<Response>;
}

const UnusedWebHandlerService = Context.Service<unknown>(
  "presentation/http/UnusedWebHandlerService",
);

export const emptyWebHandlerServices = (): Context.Context<unknown> =>
  Context.make(UnusedWebHandlerService, undefined);

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
    handler: async (request: Request, services = emptyWebHandlerServices()) => {
      const normalized = await normalizeMcpHttpRequestIds(request);
      const response = await handler(normalized.request, services);
      return restoreMcpHttpResponseIds(response, normalized.surrogateIdMap);
    },
  };
}
