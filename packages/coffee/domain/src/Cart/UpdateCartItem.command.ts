import * as Domain from "alchemy/Domain";
import { CustomerId } from "../Customer/Customer.id.ts";
import { DrinkNotFound } from "../Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { CoffeeOrderItem, DrinkSelectionChanges } from "../Menu/OrderItem.ts";
import { Session } from "../Session.middleware.ts";
import { CartItemId } from "./CartItem.id.ts";
import { CartItemNotFound } from "./CartItemNotFound.rejection.ts";
import { CartSnapshot } from "./CartSnapshot.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/** A cart line changed, re-priced. */
export class CartItemUpdated extends Domain.Event("CartItemUpdated", {
  cartItemId: CartItemId,
  item: CoffeeOrderItem,
}) {}

/** Change some of a cart line's choices; the rest stay as they were. */
export class UpdateCartItem extends Domain.Command("UpdateCartItem", {
  target: CustomerId,
  middleware: [Session],
  input: {
    cartItemId: CartItemId,
    changes: DrinkSelectionChanges,
  },
  events: [CartItemUpdated],
  rejects: [NotYourCart, CartItemNotFound, DrinkNotFound, InvalidOrder],
  reply: { cart: CartSnapshot },
}) {}
