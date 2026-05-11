import {
  type CoffeeActionJsonSchema,
  cartItemIdActionJsonSchema,
  checkoutCartActionJsonSchema,
  emptyActionJsonSchema,
  getPendingConfirmationActionJsonSchema,
  itemOptionsActionJsonSchema,
  listOrdersActionJsonSchema,
  orderItemActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
  prepareCartConfirmationActionJsonSchema,
  prepareOrderConfirmationActionJsonSchema,
  quoteOrderActionJsonSchema,
  updateCartItemActionJsonSchema,
} from "@effect-coffee-shop/coffee-actions/json-schema";

function toAssistantToolParameters(schema: CoffeeActionJsonSchema): CoffeeActionJsonSchema {
  return {
    properties: { ...schema.properties },
    required: [...schema.required],
    type: schema.type,
  };
}

export const emptyToolParameters = toAssistantToolParameters(emptyActionJsonSchema);

export const orderIdToolParameters = toAssistantToolParameters(orderIdActionJsonSchema);

export const cartItemIdToolParameters = toAssistantToolParameters(cartItemIdActionJsonSchema);

export const checkoutCartToolParameters = toAssistantToolParameters(checkoutCartActionJsonSchema);

export const itemOptionsToolParameters = toAssistantToolParameters(itemOptionsActionJsonSchema);

export const listOrdersToolParameters = toAssistantToolParameters(listOrdersActionJsonSchema);

export const orderItemToolParameters = toAssistantToolParameters(orderItemActionJsonSchema);

export const placeOrderToolParameters = toAssistantToolParameters(placeOrderActionJsonSchema);

export const prepareOrderConfirmationToolParameters = toAssistantToolParameters(
  prepareOrderConfirmationActionJsonSchema,
);

export const prepareCartConfirmationToolParameters = toAssistantToolParameters(
  prepareCartConfirmationActionJsonSchema,
);

export const getPendingConfirmationToolParameters = toAssistantToolParameters(
  getPendingConfirmationActionJsonSchema,
);

export const quoteOrderToolParameters = toAssistantToolParameters(quoteOrderActionJsonSchema);

export const updateCartItemToolParameters = toAssistantToolParameters(
  updateCartItemActionJsonSchema,
);
