import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { CoffeeActionToolkit } from "@effect-coffee-shop/coffee-actions/toolkit";

export const CoffeeActionToolsLive = McpServer.toolkit(CoffeeActionToolkit).pipe(
  Layer.provideMerge(
    CoffeeActionToolkit.toLayer(
      CoffeeOrderApp.use((app) =>
        Effect.succeed({
          list_menu: () => app.listMenu(),
          place_order: app.placeOrder,
          get_order: ({ orderId }) => app.getOrder(orderId),
          list_orders: app.listOrders,
          start_brewing: ({ orderId }) => app.startBrewing(orderId),
          mark_ready: ({ orderId }) => app.markReady(orderId),
          pick_up_order: ({ orderId }) => app.pickUpOrder(orderId),
          cancel_order: ({ orderId }) => app.cancelOrder(orderId),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeOrderApp.layer),
);
