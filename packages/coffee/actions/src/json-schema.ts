export type CoffeeActionJsonSchema = Readonly<{
  properties: Readonly<
    Record<
      string,
      Readonly<{
        description?: string;
        type: string;
      }>
    >
  >;
  required: readonly string[];
  type: "object";
}>;

export const emptyActionJsonSchema = {
  properties: {},
  required: [],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const orderIdActionJsonSchema = {
  properties: {
    orderId: {
      description: "Coffee shop ticket id, such as order-0001.",
      type: "string",
    },
  },
  required: ["orderId"],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const listOrdersActionJsonSchema = {
  properties: {
    status: {
      description: "Optional order status filter such as pending, brewing, ready, or picked-up.",
      type: "string",
    },
  },
  required: [],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const placeOrderActionJsonSchema = {
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
} as const satisfies CoffeeActionJsonSchema;
