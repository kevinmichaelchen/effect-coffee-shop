import * as Tool from "effect/unstable/ai/Tool";
import * as Toolkit from "effect/unstable/ai/Toolkit";
import { coffeeActionSpecs } from "./specs.ts";

export const ListMenuTool = Tool.make("list_menu", coffeeActionSpecs.list_menu);
export const GetItemOptionsTool = Tool.make("get_item_options", coffeeActionSpecs.get_item_options);
export const ValidateOrderTool = Tool.make("validate_order", coffeeActionSpecs.validate_order);
export const QuoteOrderTool = Tool.make("quote_order", coffeeActionSpecs.quote_order);
export const PlaceOrderTool = Tool.make("place_order", coffeeActionSpecs.place_order);
export const GetOrderTool = Tool.make("get_order", coffeeActionSpecs.get_order);
export const ListOrdersTool = Tool.make("list_orders", coffeeActionSpecs.list_orders);
export const StartBrewingTool = Tool.make("start_brewing", coffeeActionSpecs.start_brewing);
export const MarkReadyTool = Tool.make("mark_ready", coffeeActionSpecs.mark_ready);
export const PickUpOrderTool = Tool.make("pick_up_order", coffeeActionSpecs.pick_up_order);
export const CancelOrderTool = Tool.make("cancel_order", coffeeActionSpecs.cancel_order);
export const GetCartTool = Tool.make("get_cart", coffeeActionSpecs.get_cart);
export const AddCartItemTool = Tool.make("add_cart_item", coffeeActionSpecs.add_cart_item);
export const UpdateCartItemTool = Tool.make("update_cart_item", coffeeActionSpecs.update_cart_item);
export const RemoveCartItemTool = Tool.make("remove_cart_item", coffeeActionSpecs.remove_cart_item);
export const ClearCartTool = Tool.make("clear_cart", coffeeActionSpecs.clear_cart);
export const CheckoutCartTool = Tool.make("checkout_cart", coffeeActionSpecs.checkout_cart);

export const CoffeeActionToolkit = Toolkit.make(
  ListMenuTool,
  GetItemOptionsTool,
  ValidateOrderTool,
  QuoteOrderTool,
  PlaceOrderTool,
  GetOrderTool,
  ListOrdersTool,
  StartBrewingTool,
  MarkReadyTool,
  PickUpOrderTool,
  CancelOrderTool,
  GetCartTool,
  AddCartItemTool,
  UpdateCartItemTool,
  RemoveCartItemTool,
  ClearCartTool,
  CheckoutCartTool,
);
