/**
 * Defines cart item identifiers and actor-owned cart state.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { DrinkIdSchema, DrinkSizeSchema, MilkSchema, TemperatureSchema } from "./menu.ts";
import { QuantitySchema, ShotCountSchema } from "./order-primitives.ts";

const cartItemIdPattern = /^cart-item-\d+$/;

export const CartItemIdSchema = Schema.String.check(Schema.isPattern(cartItemIdPattern))
  .pipe(Schema.brand("CartItemId"))
  .annotate({
    identifier: "CartItemId",
  });
export type CartItemId = typeof CartItemIdSchema.Type;
export const cartItemIdFromString = Schema.decodeUnknownSync(CartItemIdSchema);

export const CartItemSchema = Schema.Struct({
  id: CartItemIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: Schema.OptionFromOptionalKey(MilkSchema),
  temperature: Schema.OptionFromOptionalKey(TemperatureSchema),
  shots: Schema.OptionFromOptionalKey(ShotCountSchema),
  notes: Schema.OptionFromOptionalKey(Schema.String),
  quantity: QuantitySchema,
}).annotate({ identifier: "CartItem" });
export type CartItem = typeof CartItemSchema.Type;

export const CartSchema = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemSchema),
}).annotate({ identifier: "Cart" });
export type Cart = typeof CartSchema.Type;
