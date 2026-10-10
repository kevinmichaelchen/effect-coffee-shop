/**
 * Starts the Coffee MCP stdio server on Bun.
 *
 * @module
 */
import * as BunServices from "@effect/platform-bun/BunServices";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Layer from "effect/Layer";
import { CoffeeAppLive } from "@effect-coffee-shop/coffee-backend/app-layer";
import { CoffeeMcpStdioLive } from "@effect-coffee-shop/coffee-mcp/server";

Layer.launch(
  CoffeeMcpStdioLive.pipe(Layer.provide(CoffeeAppLive), Layer.provide(BunServices.layer)),
).pipe(BunRuntime.runMain);
