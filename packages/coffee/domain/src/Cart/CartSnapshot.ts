import * as Schema from "effect/Schema";
import { CoffeeOrderItem } from "../Menu/OrderItem.ts";
import { Money } from "../Money.ts";
import { CartItemId } from "./CartItem.id.ts";
import { Checkout } from "./Checkout.ts";

/** One priced line in a cart. */
export const CartLine = Schema.Struct({
  cartItemId: CartItemId,
  item: CoffeeOrderItem,
}).annotate({ identifier: "CartLine" });
export type CartLine = typeof CartLine.Type;

/** A cart as its owner sees it: its lines, their total, and any checkout awaiting confirmation. */
export const CartSnapshot = Schema.Struct({
  items: Schema.Array(CartLine),
  totalPrice: Money,
  checkout: Schema.NullOr(Checkout),
}).annotate({ identifier: "CartSnapshot" });
export type CartSnapshot = typeof CartSnapshot.Type;
