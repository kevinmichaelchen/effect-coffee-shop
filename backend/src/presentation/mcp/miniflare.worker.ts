import { InMemoryCoffeeAppLive } from "#external/live";
import { createCoffeeWebHandler } from "#presentation/http/web-handler";
import { CoffeeMcpHttpLive } from "./server.ts";

const { handler } = createCoffeeWebHandler(CoffeeMcpHttpLive, InMemoryCoffeeAppLive);

export default {
  fetch: handler,
};
