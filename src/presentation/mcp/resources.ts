import * as Effect from "effect/Effect";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { OrderIdSchema } from "#domain/order";
import { getOrder, listMenu, listOrders } from "#service/use-cases/index";
import { prettyJson } from "../shared/json.ts";

export const MenuResource = McpServer.resource({
  uri: "coffee://menu",
  name: "Coffee Menu",
  description: "The current coffee menu",
  mimeType: "application/json",
  content: listMenu().pipe(Effect.map(prettyJson)),
});

export const OpenOrdersResource = McpServer.resource({
  uri: "coffee://orders/open",
  name: "Open Orders",
  description: "Orders that have not been picked up or cancelled",
  mimeType: "application/json",
  content: listOrders({}).pipe(
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
    orderId: () => listOrders({}).pipe(Effect.map((orders) => orders.map((order) => order.id))),
  },
  content: Effect.fn("CoffeeMcp.orderResource")(function* (_uri, orderId) {
    const order = yield* getOrder(orderId);
    return prettyJson(order);
  }),
});
