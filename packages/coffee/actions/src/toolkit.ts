import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { coffeeActionSpecs } from "./specs.ts";

export const ListMenuTool = Tool.make("list_menu", coffeeActionSpecs.list_menu);
export const PlaceOrderTool = Tool.make("place_order", coffeeActionSpecs.place_order);
export const GetOrderTool = Tool.make("get_order", coffeeActionSpecs.get_order);
export const ListOrdersTool = Tool.make("list_orders", coffeeActionSpecs.list_orders);
export const StartBrewingTool = Tool.make("start_brewing", coffeeActionSpecs.start_brewing);
export const MarkReadyTool = Tool.make("mark_ready", coffeeActionSpecs.mark_ready);
export const PickUpOrderTool = Tool.make("pick_up_order", coffeeActionSpecs.pick_up_order);
export const CancelOrderTool = Tool.make("cancel_order", coffeeActionSpecs.cancel_order);

export const CoffeeActionToolkit = Toolkit.make(
  ListMenuTool,
  PlaceOrderTool,
  GetOrderTool,
  ListOrdersTool,
  StartBrewingTool,
  MarkReadyTool,
  PickUpOrderTool,
  CancelOrderTool,
);
