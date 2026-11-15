import { withMcpActor } from "./actor.ts";
/**
 * Defines MCP resources for menu and order inspection.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as McpSchema from "effect/ai/McpSchema";
import * as McpServer from "effect/ai/McpServer";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import {
  toCoffeeOrderView,
  toCoffeeOrdersView,
  toMenuView,
} from "@effect-coffee-shop/coffee-application/contracts";
import { prettyJson } from "./json.ts";
import { withOrderReads } from "./order-reads.ts";

export const MenuResource = McpServer.resource({
  uri: "coffee://menu",
  name: "Coffee Menu",
  description: "The current coffee menu",
  mimeType: "application/json",
  content: CoffeeOrderApp.use((app) => app.listMenu).pipe(
    withMcpActor,
    Effect.map(toMenuView),
    Effect.map(prettyJson),
  ),
});

export const OpenOrdersResource = withOrderReads(({ listOrders }) =>
  McpServer.resource({
    uri: "coffee://orders/open",
    name: "Open Orders",
    description: "Orders that have not been picked up or cancelled",
    mimeType: "application/json",
    content: listOrders.pipe(
      Effect.map((orders) =>
        orders.filter((order) => order.status !== "picked-up" && order.status !== "cancelled"),
      ),
      Effect.map(toCoffeeOrdersView),
      Effect.map(prettyJson),
    ),
  }),
);

const orderIdParam = McpSchema.param("orderId", OrderId);

export const OrderResource = withOrderReads(({ getOrder, listOrders }) =>
  McpServer.resource`coffee://orders/${orderIdParam}`({
    name: "Coffee Order",
    description: "One coffee order by id",
    mimeType: "application/json",
    completion: {
      orderId: () => listOrders.pipe(Effect.map((orders) => orders.map((order) => order.id))),
    },
    content: Effect.fn("CoffeeMcp.orderResource")(function* (_uri, orderId) {
      const order = yield* getOrder(orderId);
      return prettyJson(toCoffeeOrderView(order));
    }),
  }),
);
