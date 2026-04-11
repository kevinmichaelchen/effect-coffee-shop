import type { AiTextGenerationToolLegacyInput } from "@cloudflare/workers-types";
import * as Schema from "effect/Schema";
import { ListOrdersRequestSchema, PlaceOrderRequestSchema } from "#service/contracts";

export const emptyToolParameters = {
  type: "object",
  properties: {},
  required: [],
} as const satisfies AiTextGenerationToolLegacyInput["parameters"];

export const orderIdToolParameters = {
  type: "object",
  properties: {
    orderId: {
      type: "string",
      description: "Coffee shop ticket id, such as C-104.",
    },
  },
  required: ["orderId"],
} as const satisfies AiTextGenerationToolLegacyInput["parameters"];

export const listOrdersToolParameters = {
  type: "object",
  properties: {
    status: {
      type: "string",
      description: "Optional order status filter such as pending, brewing, ready, or picked-up.",
    },
  },
  required: [],
} as const satisfies AiTextGenerationToolLegacyInput["parameters"];

export const placeOrderToolParameters = {
  type: "object",
  properties: {
    drinkId: { type: "string", description: "Menu drink id such as latte." },
    size: { type: "string", description: "Drink size such as small, medium, or large." },
    milk: { type: "string", description: "Milk choice such as whole, oat, almond, or none." },
    temperature: { type: "string", description: "Drink temperature such as hot or iced." },
    shots: { type: "integer", description: "Number of espresso shots." },
    notes: { type: "string", description: "Optional order note." },
  },
  required: ["drinkId", "size"],
} as const satisfies AiTextGenerationToolLegacyInput["parameters"];

export const decodeOrderIdInput = Schema.decodeUnknownPromise(
  Schema.Struct({
    orderId: Schema.String,
  }),
);

export const decodeListOrdersInput = Schema.decodeUnknownPromise(ListOrdersRequestSchema);

export const decodePlaceOrderInput = Schema.decodeUnknownPromise(PlaceOrderRequestSchema);
