import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";

const ListMenuTool = Tool.make("list_menu", coffeeActionSpecs.list_menu);
const PlaceOrderTool = Tool.make("place_order", coffeeActionSpecs.place_order);
const GetOrderTool = Tool.make("get_order", coffeeActionSpecs.get_order);
const ListOrdersTool = Tool.make("list_orders", coffeeActionSpecs.list_orders);
const StartBrewingTool = Tool.make("start_brewing", coffeeActionSpecs.start_brewing);
const MarkReadyTool = Tool.make("mark_ready", coffeeActionSpecs.mark_ready);
const PickUpOrderTool = Tool.make("pick_up_order", coffeeActionSpecs.pick_up_order);
const CancelOrderTool = Tool.make("cancel_order", coffeeActionSpecs.cancel_order);

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
