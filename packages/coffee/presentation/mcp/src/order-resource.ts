/**
 * Defines the dynamic MCP resource for one Coffee order.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { toCoffeeOrderView } from "@effect-coffee-shop/coffee-core/application/contracts";
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import { prettyJson } from "./json.ts";

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
    return prettyJson(toCoffeeOrderView(order));
  }),
});
