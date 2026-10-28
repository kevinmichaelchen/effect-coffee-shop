import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";

const ShopId = Schema.String.pipe(Schema.brand("ShopId"));
export type ShopId = typeof ShopId.Type;

/** The one coffee shop this deployment runs. */
export const mainShop: ShopId = ShopId.make("main");

/**
 * The coffee shop, as a key: views about the whole shop (the staff queue) are
 * keyed by it. It decides nothing yet.
 */
export class Shop extends Domain.Aggregate("Shop", {
  id: ShopId,
  state: Schema.Struct({}),
  initial: {},
  commands: [],
  decide: {},
  evolve: {},
}) {}
