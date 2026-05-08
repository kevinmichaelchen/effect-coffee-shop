import * as Context from "effect/Context";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/external-in-memory";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CurrentActor, systemActor } from "@effect-coffee-shop/core/service/CurrentActor";
import { CoffeeMcpHttpLive } from "./server.ts";

const { handler } = createCoffeeWebHandler(CoffeeMcpHttpLive, InMemoryCoffeeAppLive);

export default {
  fetch: async (request: Request) =>
    handler(request, emptyWebHandlerServices().pipe(Context.add(CurrentActor, systemActor))),
};
