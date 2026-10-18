import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CoffeeOrderItem } from "../Menu/OrderItem.ts";
import { Money } from "../Money.ts";
import { generateTypedId, typedIdPattern } from "../TypedId.ts";

/** A checkout the customer is asked to confirm, such as `checkout_session_01j…`. */
export const CheckoutId = Schema.String.check(typedIdPattern("checkout_session"))
  .pipe(Schema.brand("CheckoutId"))
  .annotate({
    identifier: "CheckoutId",
    description: "Checkout session id returned by prepare_cart_checkout.",
  });
export type CheckoutId = typeof CheckoutId.Type;
export const makeCheckoutId = generateTypedId("checkout_session").pipe(
  Effect.map((id) => CheckoutId.make(id)),
);

/** How long a prepared checkout holds its prices. */
export const checkoutLifetime = { minutes: 15 } as const;

/** The cart priced and frozen, awaiting the customer's confirmation until it expires. */
export const Checkout = Schema.Struct({
  checkoutId: CheckoutId,
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  totalPrice: Money,
  createdAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
}).annotate({ identifier: "Checkout" });
export type Checkout = typeof Checkout.Type;
