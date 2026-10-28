import { Schema } from "effect";
import { ViewerData, OrdersData, Draft, CoffeeOrder } from "./data.ts";
export const Model = Schema.Struct({
  page: Schema.Literals(["customer", "staff", "mcp", "not-found"]),
  viewer: ViewerData.schema,
  orders: OrdersData.schema,
  draft: Draft,
  displayName: Schema.String,
  feedEpoch: Schema.Natural,
  pending: Schema.Boolean,
  error: Schema.Option(Schema.String),
  receipt: Schema.Option(CoffeeOrder),
  theme: Schema.Literals(["light", "dark"]),
});
export type Model = typeof Model.Type;
