/**
 * Starts a local persistent backend that serves both HTTP API and MCP routes.
 *
 * @module
 */
import { CoffeeAppLive } from "@effect-coffee-shop/coffee-backend/app-layer";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { startCoffeeBunServer } from "./coffee-bun-server.ts";

await startCoffeeBunServer({
  appLayer: CoffeeAppLive,
  portEnv: "PORT",
  routes: CoffeeHttpApiLive,
});
