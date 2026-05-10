import {
  CartItemIdRequestSchema,
  CartViewSchema,
  CheckoutCartRequestSchema,
  CoffeeOrderViewSchema,
  CoffeeOrdersViewSchema,
  ItemOptionsRequestSchema,
  ItemOptionsViewSchema,
  ListOrdersRequestSchema,
  MenuViewSchema,
  OrderItemInputSchema,
  OrderQuoteViewSchema,
  OrderValidationViewSchema,
  PlaceOrderRequestSchema,
  QuoteOrderRequestSchema,
  UpdateCartItemRequestSchema,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import { AppErrorSchema, EmptyActionInputSchema, OrderIdActionInputSchema } from "./schemas.ts";

export const coffeeActionSpecs = {
  list_menu: {
    description: "List the current coffee menu",
    parameters: EmptyActionInputSchema,
    success: MenuViewSchema,
    failure: AppErrorSchema,
  },
  get_item_options: {
    description: "Get valid options and defaults for one menu item",
    parameters: ItemOptionsRequestSchema,
    success: ItemOptionsViewSchema,
    failure: AppErrorSchema,
  },
  validate_order: {
    description: "Validate a proposed multi-item coffee order",
    parameters: QuoteOrderRequestSchema,
    success: OrderValidationViewSchema,
    failure: AppErrorSchema,
  },
  quote_order: {
    description: "Quote a proposed multi-item coffee order",
    parameters: QuoteOrderRequestSchema,
    success: OrderQuoteViewSchema,
    failure: AppErrorSchema,
  },
  place_order: {
    description: "Create a new multi-item coffee order",
    parameters: PlaceOrderRequestSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  get_order: {
    description: "Fetch one order by id",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  list_orders: {
    description: "List orders, optionally filtered by status",
    parameters: ListOrdersRequestSchema,
    success: CoffeeOrdersViewSchema,
    failure: AppErrorSchema,
  },
  start_brewing: {
    description: "Move an order from pending to brewing",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  mark_ready: {
    description: "Move an order from brewing to ready",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  pick_up_order: {
    description: "Move an order from ready to picked-up",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  cancel_order: {
    description: "Cancel a pending or brewing order",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
  get_cart: {
    description: "Fetch the signed-in actor's current cart",
    parameters: EmptyActionInputSchema,
    success: CartViewSchema,
    failure: AppErrorSchema,
  },
  add_cart_item: {
    description: "Add a validated item to the signed-in actor's cart",
    parameters: OrderItemInputSchema,
    success: CartViewSchema,
    failure: AppErrorSchema,
  },
  update_cart_item: {
    description: "Update one item in the signed-in actor's cart",
    parameters: UpdateCartItemRequestSchema,
    success: CartViewSchema,
    failure: AppErrorSchema,
  },
  remove_cart_item: {
    description: "Remove one item from the signed-in actor's cart",
    parameters: CartItemIdRequestSchema,
    success: CartViewSchema,
    failure: AppErrorSchema,
  },
  clear_cart: {
    description: "Clear the signed-in actor's cart",
    parameters: EmptyActionInputSchema,
    success: CartViewSchema,
    failure: AppErrorSchema,
  },
  checkout_cart: {
    description: "Place the signed-in actor's cart as one multi-item order",
    parameters: CheckoutCartRequestSchema,
    success: CoffeeOrderViewSchema,
    failure: AppErrorSchema,
  },
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;
