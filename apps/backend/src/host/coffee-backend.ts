/**
 * Composes the Coffee HTTP and MCP surfaces for Fetch-based runtimes.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import {
  CurrentActor,
  type AppActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import {
  createCoffeeWebHandler,
  type CoffeeWebHandler,
} from "@effect-coffee-shop/coffee-http/web-handler";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

type CoffeeWebHandlerInput = Parameters<typeof createCoffeeWebHandler>;

export type CoffeeAppLayer = CoffeeWebHandlerInput[1];

export interface CoffeeBackend<TPersistence = never> {
  readonly appLayer: CoffeeAppLayer;
  readonly dispose: CoffeeWebHandler["dispose"];
  readonly ensureAuthPersistence: () => Promise<void>;
  readonly handler: CoffeeWebHandler["handler"];
  readonly persistence: TPersistence;
}

export interface CoffeeBackendOptions<TPersistence> {
  readonly appLayer: CoffeeAppLayer;
  readonly ensureAuthPersistence: () => Promise<void>;
  readonly persistence: TPersistence;
}

export const makeCoffeeBackend = <TPersistence>(
  options: CoffeeBackendOptions<TPersistence>,
): CoffeeBackend<TPersistence> => {
  const webHandler = createCoffeeWebHandler(
    Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
    options.appLayer,
  );

  return {
    appLayer: options.appLayer,
    dispose: webHandler.dispose,
    ensureAuthPersistence: options.ensureAuthPersistence,
    handler: webHandler.handler,
    persistence: options.persistence,
  };
};

export const createCoffeeRequestServices = (actor: AppActor): Context.Context<unknown> =>
  emptyWebHandlerServices().pipe(Context.add(CurrentActor, actor));
