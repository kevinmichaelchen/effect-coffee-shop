/**
 * Defines MCP prompts for Coffee recommendations and queue summaries.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  toCoffeeOrdersView,
  toMenuView,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { prettyJson } from "./json.ts";
import { listOpenOrders } from "./orders.ts";

export const RecommendDrinkPrompt = McpServer.prompt({
  name: "recommend-drink",
  description: "Suggest a drink from the available menu",
  parameters: {
    occasion: Schema.String,
  },
  completion: {
    occasion: () => Effect.succeed(["morning rush", "afternoon break", "late night", "decaf"]),
  },
  content: Effect.fn("CoffeeMcp.recommendDrinkPrompt")(function* ({ occasion }) {
    const app = yield* CoffeeOrderApp;
    const menu = yield* app.listMenu();
    return `Recommend one drink for "${occasion}" from this menu:\n${prettyJson(toMenuView(menu))}`;
  }),
});

export const SummarizeOpenOrdersPrompt = McpServer.prompt({
  name: "summarize-open-orders",
  description: "Summarize the current open order queue",
  parameters: {
    focus: Schema.String,
  },
  completion: {
    focus: () => Effect.succeed(["kitchen", "pickup", "operations"]),
  },
  content: Effect.fn("CoffeeMcp.summarizeOpenOrdersPrompt")(function* ({ focus }) {
    const app = yield* CoffeeOrderApp;
    const openOrders = yield* listOpenOrders(app).pipe(Effect.map(toCoffeeOrdersView));
    return `Summarize the open order queue for ${focus}:\n${prettyJson(openOrders)}`;
  }),
});
