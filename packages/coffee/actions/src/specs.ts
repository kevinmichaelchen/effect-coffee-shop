import {
  CartItemIdRequestSchema,
  CartViewSchema,
  CoffeeOrderViewSchema,
  CoffeeOrdersViewSchema,
  ConfirmedCheckoutCartRequestSchema,
  ConfirmedPlaceOrderRequestSchema,
  ItemOptionsRequestSchema,
  ItemOptionsViewSchema,
  ListOrdersRequestSchema,
  MenuViewSchema,
  OrderItemInputSchema,
  PendingOrderConfirmationLookupViewSchema,
  OrderQuoteViewSchema,
  OrderValidationViewSchema,
  PendingOrderConfirmationViewSchema,
  QuoteOrderRequestSchema,
  UpdateCartItemRequestSchema,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import type * as Schema from "effect/Schema";
import { AppErrorSchema, EmptyActionInputSchema, OrderIdActionInputSchema } from "./schemas.ts";

const actionSpec = <Parameters extends Schema.Top, Success extends Schema.Top>(input: {
  readonly description: string;
  readonly parameters: Parameters;
  readonly success: Success;
}) => ({
  ...input,
  failure: AppErrorSchema,
});

const orderStatusActionSpec = (description: string) =>
  actionSpec({
    description,
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
  });

const cartViewActionSpec = <Parameters extends Schema.Top>(
  description: string,
  parameters: Parameters,
) =>
  actionSpec({
    description,
    parameters,
    success: CartViewSchema,
  });

export const coffeeActionSpecs = {
  list_menu: actionSpec({
    description: "List the current coffee menu",
    parameters: EmptyActionInputSchema,
    success: MenuViewSchema,
  }),
  get_item_options: actionSpec({
    description: "Get valid options and defaults for one menu item",
    parameters: ItemOptionsRequestSchema,
    success: ItemOptionsViewSchema,
  }),
  validate_order: actionSpec({
    description: "Validate a proposed multi-item coffee order",
    parameters: QuoteOrderRequestSchema,
    success: OrderValidationViewSchema,
  }),
  quote_order: actionSpec({
    description: "Quote a proposed multi-item coffee order",
    parameters: QuoteOrderRequestSchema,
    success: OrderQuoteViewSchema,
  }),
  prepare_order_confirmation: actionSpec({
    description:
      "Validate, price, and store a proposed order as awaiting explicit customer confirmation",
    parameters: QuoteOrderRequestSchema,
    success: PendingOrderConfirmationViewSchema,
  }),
  prepare_cart_confirmation: actionSpec({
    description:
      "Validate, price, and store the signed-in actor's cart as awaiting explicit customer confirmation",
    parameters: EmptyActionInputSchema,
    success: PendingOrderConfirmationViewSchema,
  }),
  get_pending_confirmation: actionSpec({
    description:
      "Fetch the signed-in actor's latest pending order confirmation before final purchase",
    parameters: EmptyActionInputSchema,
    success: PendingOrderConfirmationLookupViewSchema,
  }),
  place_order: actionSpec({
    description: "Create the multi-item coffee order matching a prepared confirmation id",
    parameters: ConfirmedPlaceOrderRequestSchema,
    success: CoffeeOrderViewSchema,
  }),
  get_order: actionSpec({
    description: "Fetch one order by id",
    parameters: OrderIdActionInputSchema,
    success: CoffeeOrderViewSchema,
  }),
  list_orders: actionSpec({
    description: "List orders, optionally filtered by status",
    parameters: ListOrdersRequestSchema,
    success: CoffeeOrdersViewSchema,
  }),
  start_brewing: orderStatusActionSpec("Move an order from pending to brewing"),
  mark_ready: orderStatusActionSpec("Move an order from brewing to ready"),
  pick_up_order: orderStatusActionSpec("Move an order from ready to picked-up"),
  cancel_order: orderStatusActionSpec("Cancel a pending or brewing order"),
  get_cart: cartViewActionSpec("Fetch the signed-in actor's current cart", EmptyActionInputSchema),
  add_cart_item: cartViewActionSpec(
    "Add a validated item to the signed-in actor's cart",
    OrderItemInputSchema,
  ),
  update_cart_item: cartViewActionSpec(
    "Update one item in the signed-in actor's cart",
    UpdateCartItemRequestSchema,
  ),
  remove_cart_item: cartViewActionSpec(
    "Remove one item from the signed-in actor's cart",
    CartItemIdRequestSchema,
  ),
  clear_cart: cartViewActionSpec("Clear the signed-in actor's cart", EmptyActionInputSchema),
  checkout_cart: actionSpec({
    description: "Place the signed-in actor's cart matching a prepared confirmation id",
    parameters: ConfirmedCheckoutCartRequestSchema,
    success: CoffeeOrderViewSchema,
  }),
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;
