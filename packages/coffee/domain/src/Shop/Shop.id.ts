import * as Schema from "effect/Schema";

/**
 * A coffee shop, as a key. Views about the whole shop (the staff queue) are
 * keyed by its id directly: the shop decides nothing, so no aggregate stands
 * behind it.
 */
export const ShopId = Schema.String.pipe(Schema.brand("ShopId")).annotate({
  identifier: "ShopId",
  description: "Coffee shop id, such as main.",
});
export type ShopId = typeof ShopId.Type;

/** The one coffee shop this deployment runs. */
export const mainShop: ShopId = ShopId.make("main");
