import type { Capability } from "@better-auth/agent-auth";
import {
  cartItemIdActionJsonSchema,
  checkoutCartActionJsonSchema,
  emptyActionJsonSchema,
  getCheckoutSessionActionJsonSchema,
  itemOptionsActionJsonSchema,
  listOrdersActionJsonSchema,
  orderItemActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
  prepareCartCheckoutActionJsonSchema,
  quoteOrderActionJsonSchema,
  updateCartItemActionJsonSchema,
} from "@effect-coffee-shop/coffee-actions/json-schema";
import { type CoffeeActionName, coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";

export const customerAgentCapabilityNames = [
  "list_menu",
  "get_item_options",
  "validate_order",
  "quote_order",
  "place_order",
  "get_order",
  "list_orders",
  "get_cart",
  "add_cart_item",
  "update_cart_item",
  "remove_cart_item",
  "clear_cart",
  "prepare_cart_checkout",
  "get_checkout_session",
  "checkout_cart",
] as const satisfies readonly CoffeeActionName[];

const agentCapabilityInputs = {
  add_cart_item: orderItemActionJsonSchema,
  checkout_cart: checkoutCartActionJsonSchema,
  clear_cart: emptyActionJsonSchema,
  get_cart: emptyActionJsonSchema,
  get_checkout_session: getCheckoutSessionActionJsonSchema,
  get_order: orderIdActionJsonSchema,
  get_item_options: itemOptionsActionJsonSchema,
  list_menu: emptyActionJsonSchema,
  list_orders: listOrdersActionJsonSchema,
  place_order: placeOrderActionJsonSchema,
  prepare_cart_checkout: prepareCartCheckoutActionJsonSchema,
  quote_order: quoteOrderActionJsonSchema,
  remove_cart_item: cartItemIdActionJsonSchema,
  update_cart_item: updateCartItemActionJsonSchema,
  validate_order: quoteOrderActionJsonSchema,
} as const satisfies Pick<
  Record<CoffeeActionName, Capability["input"]>,
  (typeof customerAgentCapabilityNames)[number]
>;

const agentCapabilityDescriptions = {
  add_cart_item: coffeeActionSpecs.add_cart_item.description,
  checkout_cart: coffeeActionSpecs.checkout_cart.description,
  clear_cart: coffeeActionSpecs.clear_cart.description,
  get_cart: coffeeActionSpecs.get_cart.description,
  get_checkout_session: coffeeActionSpecs.get_checkout_session.description,
  get_order: "Fetch one of the signed-in customer's orders by id.",
  get_item_options: coffeeActionSpecs.get_item_options.description,
  list_menu: "List the current coffee menu for the signed-in customer.",
  list_orders: "List the signed-in customer's orders, optionally filtered by status.",
  place_order: coffeeActionSpecs.place_order.description,
  prepare_cart_checkout: coffeeActionSpecs.prepare_cart_checkout.description,
  quote_order: coffeeActionSpecs.quote_order.description,
  remove_cart_item: coffeeActionSpecs.remove_cart_item.description,
  update_cart_item: coffeeActionSpecs.update_cart_item.description,
  validate_order: coffeeActionSpecs.validate_order.description,
} as const satisfies Pick<
  Record<CoffeeActionName, string>,
  (typeof customerAgentCapabilityNames)[number]
>;

export const coffeeAgentCapabilities = customerAgentCapabilityNames.map((name) => ({
  approvalStrength: "session",
  description: agentCapabilityDescriptions[name],
  input: agentCapabilityInputs[name],
  name,
})) satisfies ReadonlyArray<Capability>;
