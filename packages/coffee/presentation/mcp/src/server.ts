/**
 * Composes Coffee MCP resources, prompts, and tools into server layers.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CoffeeActionToolsLive } from "./action-tools.ts";
import { McpActor } from "./actor.ts";
import { CoffeeMcpVisibility } from "./visibility.ts";
import { MenuResource, OpenOrdersResource, OrderResource } from "./resources.ts";
import { RecommendDrinkPrompt, SummarizeOpenOrdersPrompt } from "./prompts.ts";
import { CoffeeOrderingSkill } from "./skills.ts";

const mcpServerInfo = {
  name: "Coffee Orders MCP",
  protocols: [McpProtocol.v2025_06_18],
  version: "0.1.0",
} as const;

/**
 * Supplies every handler's request-level services. The actor is still resolved
 * per invocation by `withMcpActor`; this only hands handlers the resolver.
 */
const CoffeeMcpServices = McpServer.middleware<{ provides: CoffeeOrderApp | McpActor }>()(
  Effect.gen(function* () {
    const app = yield* CoffeeOrderApp;
    const actor = yield* McpActor;
    return (effect) =>
      effect.pipe(
        Effect.provideService(CoffeeOrderApp, app),
        Effect.provideService(McpActor, actor),
      );
  }),
);

export const CoffeeMcpFeaturesLive = Layer.mergeAll(
  MenuResource,
  OpenOrdersResource,
  OrderResource,
  RecommendDrinkPrompt,
  SummarizeOpenOrdersPrompt,
  CoffeeActionToolsLive,
  CoffeeOrderingSkill,
).pipe(Layer.provide(CoffeeMcpVisibility.combine(CoffeeMcpServices).layer));

export const CoffeeMcpHttpLive = (allowedOrigins: ReadonlyArray<string>) =>
  McpServer.layerHttp({
    ...mcpServerInfo,
    protocols: [McpProtocol.v2026_07_28],
    path: "/mcp",
    allowedOrigins,
    registrations: CoffeeMcpFeaturesLive,
  });
