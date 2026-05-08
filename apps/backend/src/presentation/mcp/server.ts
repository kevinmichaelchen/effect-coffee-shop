import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/service/CoffeeOrderApp";
import { CoffeeActionToolsLive } from "./action-tools.ts";
import { MenuResource, OpenOrdersResource, OrderResource } from "./resources.ts";
import { RecommendDrinkPrompt, SummarizeOpenOrdersPrompt } from "./prompts.ts";

const mcpServerInfo = {
  name: "Coffee Orders MCP",
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
);

export const CoffeeMcpHttpLive = CoffeeMcpFeaturesLive.pipe(
  Layer.provide(
    McpServer.layerHttp({
      ...mcpServerInfo,
      path: "/mcp",
    }),
  ),
);
