import { Option, Schema } from "effect";
import type { Viewer } from "#features/auth/lib/viewer.ts";
import type { AppRoute } from "#app/route.ts";

/** A live list of orders: one customer's own, or the shop's queue for staff. */
export const Feed = Schema.Union([
  Schema.TaggedStruct("CustomerOrders", { customerId: Schema.String }),
  Schema.TaggedStruct("OrderQueue", {}),
]);
export type Feed = typeof Feed.Type;

/** The live list the page shows: a customer's own orders, or the staff queue. */
export const feedFor = (viewer: Viewer, route: AppRoute): Option.Option<Feed> =>
  route._tag === "Shop" && viewer.kind !== "anonymous"
    ? Option.some({ _tag: "CustomerOrders", customerId: viewer.userId })
    : route._tag === "Staff" && viewer.kind === "staff"
      ? Option.some({ _tag: "OrderQueue" })
      : Option.none();
