/**
 * Adapts the Coffee HTTP API into a Web Fetch handler.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServer from "effect/unstable/http/HttpServer";
import { HttpObservabilityLive } from "@effect-coffee-shop/http-routing/observability";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";

export interface CoffeeWebHandler {
  readonly dispose: () => Promise<void>;
  readonly handler: (request: Request, services?: Context.Context<unknown>) => Promise<Response>;
}

/**
 * Yields to the Effect scheduler before handling each request.
 *
 * Layers such as the MCP/RPC servers fork long-lived fibers while the
 * application layer builds, and those fibers only start on the next scheduler
 * tick. On Cloudflare Workers a tick scheduled by one request never runs once
 * that request has returned, so a runtime built by a health check would leave
 * every later MCP request writing to a mailbox nobody reads. Yielding inside
 * the request that built the runtime lets every forked fiber start while that
 * request is still alive; on every other request the yield is a no-op tick.
 */
const startForkedFibersMiddleware = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.andThen(Effect.yieldNow, effect);

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
      middleware: startForkedFibersMiddleware,
    },
  );

  return {
    dispose,
    handler: (request: Request, services = emptyWebHandlerServices()) => handler(request, services),
  };
}
