import { FeedId } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Option } from "effect";
import type { Model } from "#app/model.ts";

/** The live feed the page shows: a customer's own orders, or the staff queue. */
export const feedFor = (model: Pick<Model, "viewer" | "route">): Option.Option<FeedId> =>
  model.route._tag === "Shop" && model.viewer.kind !== "anonymous"
    ? Option.some(FeedId.make(`customer:${model.viewer.userId}`))
    : model.route._tag === "Staff" && model.viewer.kind === "staff"
      ? Option.some(FeedId.make("staff"))
      : Option.none();
