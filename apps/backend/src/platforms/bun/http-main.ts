/**
 * Starts the persistent Coffee HTTP API server on Bun.
 *
 * @module
 */
import { CoffeeAppLive } from "#app-layer";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { startCoffeeBunServer } from "./coffee-bun-server.ts";

await startCoffeeBunServer({
  appLayer: CoffeeAppLive,
  routes: CoffeeHttpApiLive,
});
