import * as Domain from "@alchemy.run/domain";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Option from "effect/Option";
import { invariantViolated } from "../Invariant.ts";
import { CurrentActor } from "../CurrentActor.context.ts";
import { customerNameFor } from "../customerName.ts";
import { Order, OrderPlacedState } from "../Order/Order.aggregate.ts";
import { AlreadyPlaced, OrderPlaced } from "../Order/PlaceOrder.command.ts";
import type { CheckoutId } from "./Checkout.ts";
import { Cart, type CartState, mustOwn } from "./Cart.aggregate.ts";
import {
  CheckoutConfirmed,
  CheckoutExpired,
  CheckoutNotFound,
  ConfirmCheckout,
} from "./ConfirmCheckout.command.ts";

const requireConfirmableCheckout = Effect.fnUntraced(function* (
  { checkout }: CartState,
  checkoutId: CheckoutId,
  now: DateTime.Utc,
) {
  if (checkout === null || checkout.checkoutId !== checkoutId) {
    return yield* new CheckoutNotFound({ checkoutId });
  }
  if (DateTime.isGreaterThan(now, checkout.expiresAt)) {
    return yield* new CheckoutExpired({ checkoutId, expiredAt: checkout.expiresAt });
  }
  return checkout;
});

export class CheckoutFulfillment extends Domain.Decision(ConfirmCheckout, {
  reads: { cart: Cart, order: Order },
  keyOf: (command) => ({ cart: command.customerId, order: command.orderId }),
  decide: ({ cart, order }, command, { now }) =>
    Effect.gen(function* () {
      yield* mustOwn(cart.id);
      const checkout = yield* requireConfirmableCheckout(cart.state, command.checkoutId, now);
      if (Schema.is(OrderPlacedState)(order.state)) {
        return yield* new AlreadyPlaced({ orderId: order.id });
      }
      const actor = yield* CurrentActor;
      const customerName = yield* customerNameFor(
        actor,
        Option.fromUndefinedOr(command.customerName),
      );
      return [
        cart.record(new CheckoutConfirmed({ orderId: order.id, customerName, checkout })),
        order.record(
          new OrderPlaced({
            customerId: cart.id,
            customerName,
            items: checkout.items,
            totalPrice: checkout.totalPrice,
          }),
        ),
      ];
    }),
  reply: (_, events) => {
    const confirmation = events.find(Schema.is(CheckoutConfirmed));
    if (confirmation === undefined) return invariantViolated("Checkout requires a confirmation");
    return { orderId: confirmation.orderId };
  },
}) {}
