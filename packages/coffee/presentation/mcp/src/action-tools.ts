/**
 * Exposes Coffee actions as MCP tools.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { makeCoffeeActionHandlers } from "./action-handlers.ts";
import { CoffeeActionToolkit } from "./action-toolkit.ts";

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      CoffeeOrderApp.use((app) => Effect.succeed(makeCoffeeActionHandlers(app))),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
