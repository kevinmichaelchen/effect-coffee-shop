import * as Domain from "@alchemy.run/domain";
import { CustomerId } from "../Customer/Customer.id.ts";
import { DrinkNotFound } from "../Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { Session } from "../Session.middleware.ts";
import { Checkout, CheckoutId } from "./Checkout.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

/** The cart was priced and frozen into a checkout awaiting confirmation. */
export class CheckoutPrepared extends Domain.Event("CheckoutPrepared", { checkout: Checkout }) {}

/**
 * Price your cart and hold those prices while you confirm. A new checkout
 * replaces one still waiting.
 */
export class PrepareCheckout extends Domain.Command("PrepareCheckout", {
  target: CustomerId,
  middleware: [Session],
  input: { checkoutId: CheckoutId },
  events: [CheckoutPrepared],
  rejects: [NotYourCart, DrinkNotFound, InvalidOrder],
  reply: { checkout: Checkout },
}) {}
