import { Option, Schema } from "effect";
import type { Model } from "#app/model.ts";

/** A live list of orders: one customer's own, or the shop's queue for staff. */
export const Feed = Schema.Union([
  Schema.TaggedStruct("CustomerOrders", { customerId: Schema.String }),
  Schema.TaggedStruct("OrderQueue", {}),
]);
export type Feed = typeof Feed.Type;

/** The live list the page shows: a customer's own orders, or the staff queue. */
export const feedFor = (model: Pick<Model, "viewer" | "route">): Option.Option<Feed> =>
  model.route._tag === "Shop" && model.viewer.kind !== "anonymous"
    ? Option.some({ _tag: "CustomerOrders", customerId: model.viewer.userId })
    : model.route._tag === "Staff" && model.viewer.kind === "staff"
      ? Option.some({ _tag: "OrderQueue" })
      : Option.none();
