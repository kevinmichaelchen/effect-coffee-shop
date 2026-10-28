import { Action, Source } from "@yielded/sync";
import * as Schema from "effect/Schema";
import { CoffeeOrder } from "./CoffeeOrder.ts";

/** A separate private source for each customer, and one staff-only queue. */
export const FeedId = Schema.NonEmptyString.pipe(Schema.brand("FeedId"));
export type FeedId = typeof FeedId.Type;
export const OrderFeed = Source.make({
  kind: "orders",
  id: FeedId,
  schemaVersion: 1,
  snapshot: Schema.Struct({ orders: Schema.Array(CoffeeOrder) }),
  event: Schema.Struct({ order: CoffeeOrder }),
  actions: [
    Action.make("publish", {
      payload: Schema.Struct({ order: CoffeeOrder, version: Schema.Natural }),
      success: Schema.Null,
      error: Schema.Never,
    }),
  ],
});
