import { BunCoffeeAppLive } from "#runtime/bun/live";
import { CoffeeHttpApiLive } from "./api.ts";
import { startCoffeeBunServer } from "./bun-server.ts";

await startCoffeeBunServer({
  appLayer: BunCoffeeAppLive,
  routes: CoffeeHttpApiLive,
});
