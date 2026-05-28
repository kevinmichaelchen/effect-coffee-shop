/**
 * Starts a local in-memory backend that serves both HTTP API and MCP routes.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { CoffeeHttpApiLive } from "@effect-coffee-shop/coffee-http/api";
import { CoffeeMcpHttpLive } from "@effect-coffee-shop/coffee-mcp/server";
import { makeBunAssistantRoute } from "./assistant-route.ts";
import { startCoffeeBunServer } from "./coffee-bun-server.ts";

await startCoffeeBunServer({
  appLayer: InMemoryCoffeeAppLive,
  extraRoutes: [makeBunAssistantRoute({ appLayer: InMemoryCoffeeAppLive })],
  portEnv: "PORT",
  routes: Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
});
