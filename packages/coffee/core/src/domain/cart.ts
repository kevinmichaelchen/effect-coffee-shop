/**
 * Defines cart item identifiers and actor-owned cart state.
 *
 * @module
 */
import { makeTypeId, type TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";
import { DrinkId, DrinkSize, Milk, Temperature } from "./menu.ts";
import { Quantity, ShotCount } from "./order-primitives.ts";
import { typeId } from "./typed-id.ts";

export const CartItemIdFactory = makeTypeId("cart_item", { brand: "CartItemId" });
export type CartItemId = TypeIdFrom<typeof CartItemIdFactory>;
export const CartItemId = typeId(CartItemIdFactory).annotate({
  identifier: "CartItemId",
});
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const cartItemIdFromString = Schema.decodeUnknownSync(CartItemId);

export const CartItem = Schema.Struct({
  id: CartItemId,
  drinkId: DrinkId,
  size: DrinkSize,
  milk: Schema.OptionFromOptionalKey(Milk),
  temperature: Schema.OptionFromOptionalKey(Temperature),
  shots: Schema.OptionFromOptionalKey(ShotCount),
  notes: Schema.OptionFromOptionalKey(Schema.String),
  quantity: Quantity,
}).annotate({ identifier: "CartItem" });
export type CartItem = typeof CartItem.Type;

export const Cart = Schema.Struct({
  ownerUserId: Schema.String,
  items: Schema.Array(CartItem),
}).annotate({ identifier: "Cart" });
export type Cart = typeof Cart.Type;
