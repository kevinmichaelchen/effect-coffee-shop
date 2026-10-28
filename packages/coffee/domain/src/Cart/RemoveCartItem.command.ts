import * as Domain from "@alchemy.run/domain";
import { CustomerId } from "../Customer/Customer.id.ts";
import { Session } from "../Session.middleware.ts";
import { CartItemId } from "./CartItem.id.ts";
import { CartItemNotFound } from "./CartItemNotFound.rejection.ts";
import { CartSnapshot } from "./CartSnapshot.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/** A line left the cart. */
export class CartItemRemoved extends Domain.Event("CartItemRemoved", { cartItemId: CartItemId }) {}

/** Take one line out of your cart. */
export class RemoveCartItem extends Domain.Command("RemoveCartItem", {
  target: CustomerId,
  middleware: [Session],
  input: { cartItemId: CartItemId },
  events: [CartItemRemoved],
  rejects: [NotYourCart, CartItemNotFound],
  reply: { cart: CartSnapshot },
}) {}
