import * as Context from "effect/Context";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { createCoffeeWebHandler } from "@effect-coffee-shop/coffee-http/web-handler";
import { CurrentActor, systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";

const { handler } = createCoffeeWebHandler(CoffeeMcpHttpLive, InMemoryCoffeeAppLive);

export default {
  fetch: async (request: Request) =>
    handler(request, emptyWebHandlerServices().pipe(Context.add(CurrentActor, systemActor))),
};
