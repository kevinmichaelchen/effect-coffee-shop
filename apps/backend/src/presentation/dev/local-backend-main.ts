import * as Layer from "effect/Layer";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { CoffeeHttpApiLive } from "#presentation/http/api";
import { startCoffeeBunServer } from "#presentation/http/bun-server";
import { CoffeeMcpHttpLive } from "#presentation/mcp/server";

await startCoffeeBunServer({
  appLayer: InMemoryCoffeeAppLive,
  portEnv: "PORT",
  routes: Layer.mergeAll(CoffeeHttpApiLive, CoffeeMcpHttpLive),
});
