import * as Schema from "effect/Schema";
import { DrinkIdSchema, DrinkSizeSchema, MilkSchema, TemperatureSchema } from "./menu.ts";
import { QuantitySchema, ShotCountSchema } from "./order-primitives.ts";

const cartItemIdPattern = /^cart-item-\d+$/;

export const CartItemIdSchema = Schema.String.check(Schema.isPattern(cartItemIdPattern)).annotate({
  identifier: "CartItemId",
});
export type CartItemId = typeof CartItemIdSchema.Type;

export const CartItemSchema = Schema.Struct({
  id: CartItemIdSchema,
  drinkId: DrinkIdSchema,
  size: DrinkSizeSchema,
  milk: Schema.optionalKey(MilkSchema),
  temperature: Schema.optionalKey(TemperatureSchema),
  shots: Schema.optionalKey(ShotCountSchema),
  notes: Schema.optionalKey(Schema.String),
  quantity: QuantitySchema,
}).annotate({ identifier: "CartItem" });
export type CartItem = typeof CartItemSchema.Type;

export const CartSchema = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItemSchema),
}).annotate({ identifier: "Cart" });
export type Cart = typeof CartSchema.Type;
