/**
 * Defines the catalog of Coffee actions and their parameter/result schemas.
 *
 * @module
 */
import {
  CartItemIdRequestSchema,
  CartViewSchema,
  CheckoutSessionLookupViewSchema,
  CheckoutSessionViewSchema,
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
import * as Schema from "effect/Schema";
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
    success: Schema.Struct({ menu: MenuViewSchema }),
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
  place_order: actionSpec({
    description: "Create a new multi-item coffee order",
    parameters: PlaceOrderRequestSchema,
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
    success: Schema.Struct({ orders: CoffeeOrdersViewSchema }),
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
  prepare_cart_checkout: actionSpec({
    description:
      "Price the signed-in actor's cart and store an immutable checkout session awaiting confirmation",
    parameters: EmptyActionInputSchema,
    success: CheckoutSessionViewSchema,
  }),
  get_checkout_session: actionSpec({
    description: "Fetch the signed-in actor's latest checkout session awaiting confirmation",
    parameters: EmptyActionInputSchema,
    success: CheckoutSessionLookupViewSchema,
  }),
  checkout_cart: actionSpec({
    description: "Place the signed-in actor's cart as one multi-item order",
    parameters: CheckoutCartRequestSchema,
    success: CoffeeOrderViewSchema,
  }),
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;
