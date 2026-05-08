import type { AiTextGenerationToolLegacyInput } from "@cloudflare/workers-types";
import {
  type CoffeeActionJsonSchema,
  emptyActionJsonSchema,
  listOrdersActionJsonSchema,
  orderIdActionJsonSchema,
  placeOrderActionJsonSchema,
} from "@effect-coffee-shop/coffee-actions/json-schema";

type AssistantToolParameters = NonNullable<AiTextGenerationToolLegacyInput["parameters"]>;

function toAssistantToolParameters(schema: CoffeeActionJsonSchema): AssistantToolParameters {
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
