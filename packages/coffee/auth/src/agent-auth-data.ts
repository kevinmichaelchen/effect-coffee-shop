import type { Capability } from "@better-auth/agent-auth";

const emptyObjectSchema = {
  properties: {},
  required: [],
  type: "object",
} as const;

const listOrdersSchema = {
  properties: {
    status: {
      description: "Optional order status filter such as pending, brewing, ready, or picked-up.",
      type: "string",
    },
  },
  required: [],
  type: "object",
} as const;

const orderIdSchema = {
  properties: {
    orderId: {
      description: "Coffee shop ticket id, such as order-0001.",
      type: "string",
    },
  },
  required: ["orderId"],
  type: "object",
} as const;

const placeOrderSchema = {
  properties: {
    drinkId: {
      description: "Menu drink id such as latte.",
      type: "string",
    },
    milk: {
      description: "Milk choice such as whole, oat, almond, or none.",
      type: "string",
    },
    notes: {
      description: "Optional order note.",
      type: "string",
    },
    shots: {
      description: "Number of espresso shots.",
      type: "integer",
    },
    size: {
      description: "Drink size such as small, medium, or large.",
      type: "string",
    },
    temperature: {
      description: "Drink temperature such as hot or iced.",
      type: "string",
    },
  },
  required: ["drinkId", "size"],
  type: "object",
} as const;

export const coffeeAgentCapabilities = [
  {
    approvalStrength: "session",
    description: "List the current coffee menu for the signed-in customer.",
    input: emptyObjectSchema,
    name: "list_menu",
  },
  {
    approvalStrength: "session",
    description: "Create a new coffee order for the signed-in customer.",
    input: placeOrderSchema,
    name: "place_order",
  },
  {
    approvalStrength: "session",
    description: "Fetch one of the signed-in customer's orders by id.",
    input: orderIdSchema,
    name: "get_order",
  },
  {
    approvalStrength: "session",
    description: "List the signed-in customer's orders, optionally filtered by status.",
    input: listOrdersSchema,
    name: "list_orders",
  },
] as const satisfies ReadonlyArray<Capability>;
