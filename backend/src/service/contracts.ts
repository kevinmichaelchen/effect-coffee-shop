import * as Schema from "effect/Schema";

export const PlaceOrderRequestSchema = Schema.Struct({
  customerName: Schema.String,
  drinkId: Schema.String,
  size: Schema.String,
  milk: Schema.optionalKey(Schema.String),
  temperature: Schema.optionalKey(Schema.String),
  shots: Schema.optionalKey(Schema.Int),
  notes: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "PlaceOrderRequest" });
export type PlaceOrderRequest = typeof PlaceOrderRequestSchema.Type;

export const ListOrdersRequestSchema = Schema.Struct({
  status: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ListOrdersRequest" });
export type ListOrdersRequest = typeof ListOrdersRequestSchema.Type;
