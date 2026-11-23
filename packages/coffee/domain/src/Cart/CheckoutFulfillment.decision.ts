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
import { awaitingCheckout, Cart, mustOwn } from "./Cart.aggregate.ts";
import {
  CheckoutConfirmed,
  CheckoutExpired,
  CheckoutNotFound,
  ConfirmCheckout,
} from "./ConfirmCheckout.command.ts";

export class CheckoutFulfillment extends Domain.Decision(ConfirmCheckout, {
  reads: { cart: Cart, order: Order },
  keyOf: (command) => ({ cart: command.customerId, order: command.orderId }),
  decide: ({ cart, order }, command, { now }) =>
    Effect.gen(function* () {
      yield* mustOwn(cart.id);
      const checkout = yield* Effect.fromOption(
        awaitingCheckout(cart.state, command.checkoutId),
      ).pipe(Effect.mapError(() => new CheckoutNotFound({ checkoutId: command.checkoutId })));
      if (DateTime.isGreaterThan(now, checkout.expiresAt)) {
        return yield* new CheckoutExpired({
          checkoutId: checkout.checkoutId,
          expiredAt: checkout.expiresAt,
        });
      }
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
  reply: (_, events) => ({
    orderId: Option.match(Option.fromUndefinedOr(events.find(Schema.is(CheckoutConfirmed))), {
      onSome: (event) => event.orderId,
      onNone: () => invariantViolated("Checkout requires a confirmation"),
    }),
  }),
}) {}
