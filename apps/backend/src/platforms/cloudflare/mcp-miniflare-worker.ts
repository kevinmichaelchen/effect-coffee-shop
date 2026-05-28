/**
 * Provides a Miniflare worker entrypoint for exercising the MCP HTTP server.
 *
 * @module
 */
import * as Context from "effect/Context";
import { emptyWebHandlerServices } from "@effect-coffee-shop/fetch-host/request-services";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

const { handler } = createCoffeeWebHandler(CoffeeMcpHttpLive, InMemoryCoffeeAppLive);

/** @public Miniflare module worker entrypoint. */
export default {
  fetch: async (request: Request) =>
    handler(request, emptyWebHandlerServices().pipe(Context.add(CurrentActor, systemActor))),
};
