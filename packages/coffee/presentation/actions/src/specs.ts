/**
 * Defines the catalog of Coffee actions and their parameter/result schemas.
 *
 * @module
 */
import {
  CartItemIdRequest,
  CartView,
  CheckoutSessionLookupView,
  CheckoutSessionView,
  CheckoutCartRequest,
  CoffeeOrderView,
  CoffeeOrdersView,
  ItemOptionsRequest,
  ItemOptionsView,
  ListOrdersRequest,
  MenuView,
  OrderItemInput,
  OrderQuoteView,
  OrderValidationView,
  PlaceOrderRequest,
  QuoteOrderRequest,
  UpdateCartItemRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import * as Schema from "effect/Schema";
import { AppError, EmptyActionInput, OrderIdActionInput } from "./schemas.ts";

const actionSpec = <Parameters extends Schema.Top, Success extends Schema.Top>(input: {
  readonly description: string;
  readonly parameters: Parameters;
  readonly success: Success;
}) => ({
  ...input,
  failure: AppError,
});

const inlineStruct = <Fields extends Schema.Struct.Fields>(schema: { readonly fields: Fields }) =>
  Schema.Struct(schema.fields);

const orderStatusActionSpec = (description: string) =>
  actionSpec({
    description,
    parameters: OrderIdActionInput,
    success: inlineStruct(CoffeeOrderView),
  });

const cartViewActionSpec = <Parameters extends Schema.Top>(
  description: string,
  parameters: Parameters,
) =>
  actionSpec({
    description,
    parameters,
    success: inlineStruct(CartView),
  });

export const coffeeActionSpecs = {
  list_menu: actionSpec({
    description: "List the current coffee menu",
    parameters: EmptyActionInput,
    success: Schema.Struct({ menu: MenuView }),
  }),
  get_item_options: actionSpec({
    description: "Get valid options and defaults for one menu item",
    parameters: inlineStruct(ItemOptionsRequest),
    success: inlineStruct(ItemOptionsView),
  }),
  validate_order: actionSpec({
    description: "Validate a proposed multi-item coffee order",
    parameters: inlineStruct(QuoteOrderRequest),
    success: inlineStruct(OrderValidationView),
  }),
  quote_order: actionSpec({
    description: "Quote a proposed multi-item coffee order",
    parameters: inlineStruct(QuoteOrderRequest),
    success: inlineStruct(OrderQuoteView),
  }),
  place_order: actionSpec({
    description: "Create a new multi-item coffee order",
    parameters: inlineStruct(PlaceOrderRequest),
    success: inlineStruct(CoffeeOrderView),
  }),
  get_order: actionSpec({
    description: "Fetch one order by id",
    parameters: OrderIdActionInput,
    success: CoffeeOrderView,
  }),
  list_orders: actionSpec({
    description: "List orders, optionally filtered by status",
    parameters: inlineStruct(ListOrdersRequest),
    success: Schema.Struct({ orders: CoffeeOrdersView }),
  }),
  start_brewing: orderStatusActionSpec("Move an order from pending to brewing"),
  mark_ready: orderStatusActionSpec("Move an order from brewing to ready"),
  pick_up_order: orderStatusActionSpec("Move an order from ready to picked-up"),
  cancel_order: orderStatusActionSpec("Cancel a pending or brewing order"),
  get_cart: cartViewActionSpec("Fetch the signed-in actor's current cart", EmptyActionInput),
  add_cart_item: cartViewActionSpec(
    "Add a validated item to the signed-in actor's cart",
    inlineStruct(OrderItemInput),
  ),
  update_cart_item: cartViewActionSpec(
    "Update one item in the signed-in actor's cart",
    inlineStruct(UpdateCartItemRequest),
  ),
  remove_cart_item: cartViewActionSpec(
    "Remove one item from the signed-in actor's cart",
    inlineStruct(CartItemIdRequest),
  ),
  clear_cart: cartViewActionSpec("Clear the signed-in actor's cart", EmptyActionInput),
  prepare_cart_checkout: actionSpec({
    description:
      "Price the signed-in actor's cart and store an immutable checkout session awaiting confirmation",
    parameters: EmptyActionInput,
    success: inlineStruct(CheckoutSessionView),
  }),
  get_checkout_session: actionSpec({
    description: "Fetch the signed-in actor's latest checkout session awaiting confirmation",
    parameters: EmptyActionInput,
    success: CheckoutSessionLookupView,
  }),
  checkout_cart: actionSpec({
    description: "Place the signed-in actor's cart as one multi-item order",
    parameters: inlineStruct(CheckoutCartRequest),
    success: inlineStruct(CoffeeOrderView),
  }),
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;
