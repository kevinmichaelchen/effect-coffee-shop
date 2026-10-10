import * as Effect from "effect/Effect";
import { systemActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import { McpActor } from "./actor.ts";
/**
 * Composes Coffee MCP resources, prompts, and tools into server layers.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CoffeeActionToolsLive } from "./action-tools.ts";
import { MenuResource, OpenOrdersResource, OrderResource } from "./resources.ts";
import { RecommendDrinkPrompt, SummarizeOpenOrdersPrompt } from "./prompts.ts";

const mcpServerInfo = {
  name: "Coffee Orders MCP",
  protocols: [McpProtocol.v2025_06_18],
  version: "0.1.0",
} as const;

const CoffeeMcpSharedFeaturesLive = Layer.mergeAll(
  MenuResource,
  OpenOrdersResource,
  OrderResource,
  RecommendDrinkPrompt,
  SummarizeOpenOrdersPrompt,
).pipe(Layer.provide(CoffeeOrderApp.layer));

const CoffeeMcpFeaturesLive = Layer.mergeAll(CoffeeMcpSharedFeaturesLive, CoffeeActionToolsLive);

export const CoffeeMcpStdioLive = CoffeeMcpFeaturesLive.pipe(
  Layer.provide(McpServer.layerStdio(mcpServerInfo)),
  Layer.provide(Layer.succeed(McpActor, { current: Effect.succeed(systemActor) })),
);

export const CoffeeMcpHttpLive = (allowedOrigins: ReadonlyArray<string>) =>
  CoffeeMcpFeaturesLive.pipe(
    Layer.provide(
      McpServer.layerHttp({
        ...mcpServerInfo,
        protocols: [McpProtocol.v2026_07_28],
        path: "/mcp",
        allowedOrigins,
      }),
    ),
  );
