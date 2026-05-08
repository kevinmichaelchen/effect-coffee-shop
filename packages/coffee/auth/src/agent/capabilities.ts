import type { Capability } from "@better-auth/agent-auth";
import {
  emptyActionJsonSchema,
  listOrdersActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
} from "@effect-coffee-shop/coffee-actions/json-schema";
import { type CoffeeActionName, coffeeActionSpecs } from "@effect-coffee-shop/coffee-actions/specs";

export const customerAgentCapabilityNames = [
  "list_menu",
  "place_order",
  "get_order",
  "list_orders",
] as const satisfies readonly CoffeeActionName[];

const agentCapabilityInputs = {
  get_order: orderIdActionJsonSchema,
  list_menu: emptyActionJsonSchema,
  list_orders: listOrdersActionJsonSchema,
  place_order: placeOrderActionJsonSchema,
} as const satisfies Pick<
  Record<CoffeeActionName, Capability["input"]>,
  (typeof customerAgentCapabilityNames)[number]
>;

const agentCapabilityDescriptions = {
  get_order: "Fetch one of the signed-in customer's orders by id.",
  list_menu: "List the current coffee menu for the signed-in customer.",
  list_orders: "List the signed-in customer's orders, optionally filtered by status.",
  place_order: coffeeActionSpecs.place_order.description,
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
