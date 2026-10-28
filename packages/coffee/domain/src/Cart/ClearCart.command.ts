import * as Domain from "@alchemy.run/domain";
import { CustomerId } from "../Customer/Customer.id.ts";
import { Session } from "../Session.middleware.ts";
import { CartSnapshot } from "./CartSnapshot.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/** The cart was emptied, and any checkout awaiting confirmation dropped. */
export class CartCleared extends Domain.Event("CartCleared") {}

/** Empty your cart. An empty cart stays as it is. */
export class ClearCart extends Domain.Command("ClearCart", {
  target: CustomerId,
  middleware: [Session],
  events: [CartCleared],
  rejects: [NotYourCart],
  reply: { cart: CartSnapshot },
}) {}
