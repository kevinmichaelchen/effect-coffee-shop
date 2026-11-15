/**
 * Composes Coffee MCP resources, prompts, and tools into server layers.
 *
 * @module
 */
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpProtocol from "effect/ai/McpProtocol";
import * as McpServer from "effect/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CoffeeActionToolsLive } from "./action-tools.ts";
import { McpActor } from "./actor.ts";
import { CoffeeDomainToolsLive } from "./domain-tools.ts";
import { CoffeeMcpVisibility } from "./visibility.ts";
import { MenuResource, OpenOrdersResource, OrderResource } from "./resources.ts";
import { RecommendDrinkPrompt, SummarizeOpenOrdersPrompt } from "./prompts.ts";
import { CoffeeOrderingSkill } from "./skills.ts";

const mcpServerInfo = {
  name: "Coffee Orders MCP",
  version: "0.1.0",
} as const;

/**
 * How long a client may reuse each list. Everything the server lists is static
 * except the tools: `CoffeeMcpVisibility` hides the staff tools from everyone
 * else, so a cached tool list could show one caller another caller's tools.
 * The protocol only has a private scope, and a client shared between users is
 * still one cache, so tools stay at a zero TTL, which is also the default.
 */
const mcpCacheHints = {
  discover: { ttl: Duration.minutes(5), cacheScope: "private" },
  resources: { ttl: Duration.minutes(5), cacheScope: "private" },
  resourceTemplates: { ttl: Duration.minutes(5), cacheScope: "private" },
  prompts: { ttl: Duration.minutes(5), cacheScope: "private" },
  skills: { ttl: Duration.minutes(5), cacheScope: "private" },
  tools: { ttl: Duration.zero, cacheScope: "private" },
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
        // oxlint-disable-next-line anti-slop/no-reprovide-ambient-service -- this middleware exists to hand handlers its `provides` services.
        Effect.provideService(CoffeeOrderApp, app),
        // oxlint-disable-next-line anti-slop/no-reprovide-ambient-service -- this middleware exists to hand handlers its `provides` services.
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
  CoffeeDomainToolsLive,
  CoffeeOrderingSkill,
).pipe(Layer.provide(CoffeeMcpVisibility.combine(CoffeeMcpServices).layer));

export const CoffeeMcpHttpLive = (allowedOrigins: ReadonlyArray<string>) =>
  McpServer.layerHttpRequestScoped({
    ...mcpServerInfo,
    protocols: [McpProtocol.v2026_07_28],
    cacheHints: mcpCacheHints,
    path: "/mcp",
    allowedOrigins,
    registrations: CoffeeMcpFeaturesLive,
  });
