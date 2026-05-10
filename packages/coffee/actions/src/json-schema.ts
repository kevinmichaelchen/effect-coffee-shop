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

export const itemOptionsActionJsonSchema = {
  properties: {
    drinkId: {
      description: "Menu drink id such as latte.",
      type: "string",
    },
  },
  required: ["drinkId"],
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
    items: {
      description:
        "Order line items. Each item should include drinkId, size, and optional milk, temperature, shots, notes, and quantity.",
      type: "array",
    },
  },
  required: ["items"],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const quoteOrderActionJsonSchema = placeOrderActionJsonSchema;

export const orderItemActionJsonSchema = {
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
      description: "Optional item note.",
      type: "string",
    },
    quantity: {
      description: "Positive line quantity.",
      type: "integer",
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

export const updateCartItemActionJsonSchema = {
  properties: {
    cartItemId: {
      description: "Cart line id, such as cart-item-0001.",
      type: "string",
    },
    drinkId: {
      description: "Optional replacement menu drink id.",
      type: "string",
    },
    milk: {
      description: "Optional replacement milk choice.",
      type: "string",
    },
    notes: {
      description: "Optional replacement item note.",
      type: "string",
    },
    quantity: {
      description: "Optional positive replacement line quantity.",
      type: "integer",
    },
    shots: {
      description: "Optional replacement espresso shot count.",
      type: "integer",
    },
    size: {
      description: "Optional replacement drink size.",
      type: "string",
    },
    temperature: {
      description: "Optional replacement drink temperature.",
      type: "string",
    },
  },
  required: ["cartItemId"],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const cartItemIdActionJsonSchema = {
  properties: {
    cartItemId: {
      description: "Cart line id, such as cart-item-0001.",
      type: "string",
    },
  },
  required: ["cartItemId"],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;

export const checkoutCartActionJsonSchema = {
  properties: {
    customerName: {
      description: "Optional customer display name for system/staff checkout.",
      type: "string",
    },
  },
  required: [],
  type: "object",
} as const satisfies CoffeeActionJsonSchema;
