import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";
import { CustomerId } from "../Customer/Customer.id.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { OrderId } from "../Order/Order.id.ts";
import { Session } from "../Session.middleware.ts";
import { Checkout, CheckoutId } from "./Checkout.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

export class CheckoutNotFound extends Domain.Rejection("CheckoutNotFound", {
  checkoutId: CheckoutId,
}) {}

export class CheckoutExpired extends Domain.Rejection("CheckoutExpired", {
  checkoutId: CheckoutId,
  expiredAt: Schema.DateTimeUtc,
}) {}

/**
 * The customer confirmed their checkout: the cart is emptied, and the order
 * is placed at the checkout's prices (by `CheckoutFulfillment`).
 */
export class CheckoutConfirmed extends Domain.Event("CheckoutConfirmed", {
  orderId: OrderId,
  customerName: CustomerName,
  checkout: Checkout,
}) {}

/** Confirm the checkout you prepared, before it expires, as order `orderId`. */
export class ConfirmCheckout extends Domain.Command("ConfirmCheckout", {
  target: CustomerId,
  middleware: [Session],
  input: {
    checkoutId: CheckoutId,
    orderId: OrderId,
    customerName: Schema.optionalKey(
      Schema.Trim.annotate({ description: "Customer display name, for system orders." }),
    ),
  },
  events: [CheckoutConfirmed],
  rejects: [NotYourCart, CheckoutNotFound, CheckoutExpired, InvalidOrder],
  reply: { orderId: OrderId },
}) {}
