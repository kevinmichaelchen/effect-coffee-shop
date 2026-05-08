import { CoffeeAppLive } from "#app-layer";
import { CoffeeHttpApiLive } from "./api.ts";
import { startCoffeeBunServer } from "./bun-server.ts";

await startCoffeeBunServer({
  appLayer: CoffeeAppLive,
  routes: CoffeeHttpApiLive,
});
