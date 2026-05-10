import {
  type CoffeeActionJsonSchema,
  emptyActionJsonSchema,
  listOrdersActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
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

export const listOrdersToolParameters = toAssistantToolParameters(listOrdersActionJsonSchema);

export const placeOrderToolParameters = toAssistantToolParameters(placeOrderActionJsonSchema);
