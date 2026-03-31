import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CoffeeCodeModeToolsLive } from "./code-mode.ts";
import { CoffeeClassicToolsLive } from "./classic-tools.ts";
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

export const CoffeeMcpClassicFeaturesLive = Layer.mergeAll(
  CoffeeMcpSharedFeaturesLive,
  CoffeeClassicToolsLive,
);

export const CoffeeMcpCodeModeFeaturesLive = Layer.mergeAll(
  CoffeeMcpSharedFeaturesLive,
  CoffeeCodeModeToolsLive,
);

export const CoffeeMcpClassicStdioLive = CoffeeMcpClassicFeaturesLive.pipe(
  Layer.provide(McpServer.layerStdio(mcpServerInfo)),
);

export const CoffeeMcpCodeModeStdioLive = CoffeeMcpCodeModeFeaturesLive.pipe(
  Layer.provide(McpServer.layerStdio(mcpServerInfo)),
);

export const CoffeeMcpClassicHttpLive = CoffeeMcpClassicFeaturesLive.pipe(
  Layer.provide(
    McpServer.layerHttp({
      ...mcpServerInfo,
      path: "/mcp",
    }),
  ),
);
