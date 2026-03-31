import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { coffeeMcpActionSpecs } from "./actions.ts";

const ListMenuTool = Tool.make("list_menu", coffeeMcpActionSpecs.list_menu);
const PlaceOrderTool = Tool.make("place_order", coffeeMcpActionSpecs.place_order);
const GetOrderTool = Tool.make("get_order", coffeeMcpActionSpecs.get_order);
const ListOrdersTool = Tool.make("list_orders", coffeeMcpActionSpecs.list_orders);
const StartBrewingTool = Tool.make("start_brewing", coffeeMcpActionSpecs.start_brewing);
const MarkReadyTool = Tool.make("mark_ready", coffeeMcpActionSpecs.mark_ready);
const PickUpOrderTool = Tool.make("pick_up_order", coffeeMcpActionSpecs.pick_up_order);
const CancelOrderTool = Tool.make("cancel_order", coffeeMcpActionSpecs.cancel_order);

const CoffeeActionToolkit = Toolkit.make(
  ListMenuTool,
  PlaceOrderTool,
  GetOrderTool,
  ListOrdersTool,
  StartBrewingTool,
  MarkReadyTool,
  PickUpOrderTool,
  CancelOrderTool,
);

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
