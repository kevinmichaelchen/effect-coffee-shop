import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpServer from "effect/unstable/ai/McpServer";
import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { coffeeMcpActionSpecs, CoffeeMcpActions } from "./actions.ts";

const ListMenuTool = Tool.make("list_menu", coffeeMcpActionSpecs.list_menu);
const PlaceOrderTool = Tool.make("place_order", coffeeMcpActionSpecs.place_order);
const GetOrderTool = Tool.make("get_order", coffeeMcpActionSpecs.get_order);
const ListOrdersTool = Tool.make("list_orders", coffeeMcpActionSpecs.list_orders);
const StartBrewingTool = Tool.make("start_brewing", coffeeMcpActionSpecs.start_brewing);
const MarkReadyTool = Tool.make("mark_ready", coffeeMcpActionSpecs.mark_ready);
const PickUpOrderTool = Tool.make("pick_up_order", coffeeMcpActionSpecs.pick_up_order);
const CancelOrderTool = Tool.make("cancel_order", coffeeMcpActionSpecs.cancel_order);

export const CoffeeClassicToolkit = Toolkit.make(
  ListMenuTool,
  PlaceOrderTool,
  GetOrderTool,
  ListOrdersTool,
  StartBrewingTool,
  MarkReadyTool,
  PickUpOrderTool,
  CancelOrderTool,
);

export const CoffeeClassicToolsLive = McpServer.toolkit(CoffeeClassicToolkit).pipe(
  Layer.provideMerge(
    CoffeeClassicToolkit.toLayer(
      CoffeeMcpActions.use((actions) =>
        Effect.succeed({
          list_menu: () => actions.list_menu(),
          place_order: (input) => actions.place_order(input),
          get_order: (input) => actions.get_order(input),
          list_orders: (input) => actions.list_orders(input),
          start_brewing: (input) => actions.start_brewing(input),
          mark_ready: (input) => actions.mark_ready(input),
          pick_up_order: (input) => actions.pick_up_order(input),
          cancel_order: (input) => actions.cancel_order(input),
        }),
      ),
    ),
  ),
  Layer.provide(CoffeeMcpActions.layer),
);
