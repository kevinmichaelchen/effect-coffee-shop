import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import { Cart } from "./Cart.aggregate.ts";
import { CheckoutConfirmed } from "./ConfirmCheckout.command.ts";
import { FulfillCheckout } from "./FulfillCheckout.saga.ts";

/** Whenever a customer confirms a checkout, place their order at the checkout's prices. */
export class CheckoutFulfillment extends Domain.Policy("CheckoutFulfillment", {
  from: Cart,
  on: [CheckoutConfirmed],
}) {}

export const CheckoutFulfillmentLive = CheckoutFulfillment.toLayer(
  Effect.gen(function* () {
    const fulfillments = yield* FulfillCheckout;
    return Effect.fn("CheckoutFulfillment.start")(function* ({ source, event }) {
      yield* fulfillments.start(event.orderId, {
        customerId: source.id,
        customerName: event.customerName,
        checkout: event.checkout,
      });
    });
  }),
);
