import * as Effect from "effect/Effect";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/service/CoffeeOrderApp";
import { prettyJson } from "../shared/json.ts";

export const MenuResource = McpServer.resource({
  uri: "coffee://menu",
  name: "Coffee Menu",
  description: "The current coffee menu",
  mimeType: "application/json",
  content: CoffeeOrderApp.use((app) => app.listMenu()).pipe(Effect.map(prettyJson)),
});

export const OpenOrdersResource = McpServer.resource({
  uri: "coffee://orders/open",
  name: "Open Orders",
  description: "Orders that have not been picked up or cancelled",
  mimeType: "application/json",
  content: CoffeeOrderApp.use((app) => app.listOrders({})).pipe(
    Effect.map((orders) =>
      orders.filter((order) => order.status !== "picked-up" && order.status !== "cancelled"),
    ),
    Effect.map(prettyJson),
  ),
});

const orderIdParam = McpSchema.param("orderId", OrderIdSchema);

export const OrderResource = McpServer.resource`coffee://orders/${orderIdParam}`({
  name: "Coffee Order",
  description: "One coffee order by id",
  mimeType: "application/json",
  completion: {
    orderId: () =>
      CoffeeOrderApp.use((app) => app.listOrders({})).pipe(
        Effect.map((orders) => orders.map((order) => order.id)),
      ),
  },
  content: Effect.fn("CoffeeMcp.orderResource")(function* (_uri, orderId) {
    const app = yield* CoffeeOrderApp;
    const order = yield* app.getOrder(orderId);
    return prettyJson(order);
  }),
});
