/**
 * Defines MCP resources for menu and order inspection.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import {
  toCoffeeOrdersView,
  toMenuView,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { prettyJson } from "./json.ts";
import { listOpenOrders } from "./orders.ts";

export const MenuResource = McpServer.resource({
  uri: "coffee://menu",
  name: "Coffee Menu",
  description: "The current coffee menu",
  mimeType: "application/json",
  content: CoffeeOrderApp.use((app) => app.listMenu()).pipe(
    Effect.map(toMenuView),
    Effect.map(prettyJson),
  ),
});

export const OpenOrdersResource = McpServer.resource({
  uri: "coffee://orders/open",
  name: "Open Orders",
  description: "Orders that have not been picked up or cancelled",
  mimeType: "application/json",
  content: CoffeeOrderApp.use(listOpenOrders).pipe(
    Effect.map(toCoffeeOrdersView),
    Effect.map(prettyJson),
  ),
});

export { OrderResource } from "./order-resource.ts";
