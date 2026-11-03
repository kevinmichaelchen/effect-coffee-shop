/**
 * Defines the catalog of Coffee actions and their parameter/result schemas.
 *
 * @module
 */
import {
  ItemOptionsRequest,
  ItemOptionsView,
  MenuView,
  OrderQuoteView,
  OrderValidationView,
  QuoteOrderRequest,
} from "@effect-coffee-shop/coffee-application/contracts";
import * as Schema from "effect/Schema";
import { AppError, EmptyActionInput, OrderingContextView } from "./schemas.ts";

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

/**
 * The hand-written tools: the menu, checks of a proposed order, and the ids
 * an agent needs for the domain's tools. Orders, carts, checkout and the
 * staff lifecycle are tools generated from the domain Apis instead.
 */
export const coffeeActionSpecs = {
  get_ordering_context: actionSpec({
    description:
      "Who you act for and fresh ids for the domain tools: customerId keys their cart (CustomerApi_Cart_get, the cart commands' target) and order list (CustomerApi_CustomerOrders_get); newIds are an orderId, a cartItemId and a checkoutId to send with a new order, cart line or checkout. Call again for more ids.",
    parameters: EmptyActionInput,
    success: OrderingContextView,
  }),
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
} as const;

export type CoffeeActionName = keyof typeof coffeeActionSpecs;
