import * as Domain from "@alchemy.run/domain";
import { CustomerId } from "../Customer/Customer.id.ts";
import { DrinkNotFound } from "../Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { CoffeeOrderItem, DrinkSelection } from "../Menu/OrderItem.ts";
import { Session } from "../Session.middleware.ts";
import { CartItemId } from "./CartItem.id.ts";
import { CartSnapshot } from "./CartSnapshot.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/** A priced drink went into the cart. */
export class CartItemAdded extends Domain.Event("CartItemAdded", {
  cartItemId: CartItemId,
  item: CoffeeOrderItem,
}) {}

/** Add a drink to your cart. Adding the same line id again changes nothing. */
export class AddCartItem extends Domain.Command("AddCartItem", {
  target: CustomerId,
  middleware: [Session],
  input: { cartItemId: CartItemId, item: DrinkSelection },
  events: [CartItemAdded],
  rejects: [NotYourCart, DrinkNotFound, InvalidOrder],
  reply: { cart: CartSnapshot },
}) {}
