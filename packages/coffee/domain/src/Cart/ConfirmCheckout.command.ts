import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";
import { CustomerId } from "../Customer/Customer.id.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { AlreadyPlaced, OrderPlaced } from "../Order/PlaceOrder.command.ts";
import { OrderId } from "../Order/Order.id.ts";
import { Session } from "../Session.middleware.ts";
import { Checkout, CheckoutId } from "./Checkout.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";

export class CheckoutNotFound extends Domain.Rejection(
  "CheckoutNotFound",
  {
    checkoutId: CheckoutId,
  },
  { httpApiStatus: 404 },
) {}

export class CheckoutExpired extends Domain.Rejection(
  "CheckoutExpired",
  {
    checkoutId: CheckoutId,
    expiredAt: Schema.DateTimeUtc,
  },
  { httpApiStatus: 409 },
) {}

/**
 * The customer confirmed their checkout: the cart is emptied, and the order
 * is placed at the checkout's prices in the same decision.
 */
export class CheckoutConfirmed extends Domain.Event("CheckoutConfirmed", {
  orderId: OrderId,
  customerName: CustomerName,
  checkout: Checkout,
}) {}

/** Confirm the checkout you prepared, before it expires, as order `orderId`. */
export class ConfirmCheckout extends Domain.Command(
  "ConfirmCheckout",
  {
    middleware: [Session],
    input: {
      customerId: CustomerId,
      checkoutId: CheckoutId,
      orderId: OrderId,
      customerName: Schema.optionalKey(
        Schema.Trim.annotate({ description: "Customer display name, for system orders." }),
      ),
    },
    events: [CheckoutConfirmed, OrderPlaced],
    rejects: [NotYourCart, CheckoutNotFound, CheckoutExpired, InvalidOrder, AlreadyPlaced],
    reply: { orderId: OrderId },
  },
  {
    description:
      "Confirm the checkout you prepared, before it expires, once the customer agreed to its items and total. The cart is emptied and its order is placed as the order id you made.",
  },
) {}
