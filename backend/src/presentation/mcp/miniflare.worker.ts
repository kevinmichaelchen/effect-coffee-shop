import * as ServiceMap from "effect/ServiceMap";
import { InMemoryCoffeeAppLive } from "#external/live";
import { createCoffeeWebHandler, emptyWebHandlerServices } from "#presentation/http/web-handler";
import { CurrentActor, systemActor } from "#service/CurrentActor";
import { CoffeeMcpHttpLive } from "./server.ts";

const { handler } = createCoffeeWebHandler(CoffeeMcpHttpLive, InMemoryCoffeeAppLive);

export default {
  fetch: async (request: Request) =>
    handler(request, emptyWebHandlerServices().pipe(ServiceMap.add(CurrentActor, systemActor))),
};
