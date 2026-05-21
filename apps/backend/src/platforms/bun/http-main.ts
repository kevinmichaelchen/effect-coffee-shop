import { CoffeeAppLive } from "#app-layer";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { startCoffeeBunServer } from "@effect-coffee-shop/coffee-http/bun-server";

await startCoffeeBunServer({
  appLayer: CoffeeAppLive,
  routes: CoffeeHttpApiLive,
});
