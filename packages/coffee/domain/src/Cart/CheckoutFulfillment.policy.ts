import * as Domain from "alchemy/Domain";
import * as Effect from "effect/Effect";
import { Order } from "../Order/Order.aggregate.ts";
import { PlaceCheckedOutOrder } from "../Order/PlaceCheckedOutOrder.command.ts";
import { Cart } from "./Cart.aggregate.ts";
import { CheckoutConfirmed } from "./ConfirmCheckout.command.ts";

/** Whenever a customer confirms a checkout, place their order at the checkout's prices. */
export class CheckoutFulfillment extends Domain.Policy("CheckoutFulfillment", {
  from: Cart,
  on: [CheckoutConfirmed],
}) {}

export const CheckoutFulfillmentLive = CheckoutFulfillment.toLayer(
  Effect.gen(function* () {
    const orders = yield* Order;
    return Effect.fn(function* ({ source, event }) {
      yield* orders.send(
        event.orderId,
        new PlaceCheckedOutOrder({
          customerId: source.id,
          customerName: event.customerName,
          checkout: event.checkout,
        }),
      );
    });
  }),
);
