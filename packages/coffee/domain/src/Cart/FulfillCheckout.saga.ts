import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import { Activity } from "effect/workflow";
import { CustomerId } from "../Customer/Customer.id.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { Order } from "../Order/Order.aggregate.ts";
import { OrderId } from "../Order/Order.id.ts";
import { PlaceCheckedOutOrder } from "../Order/PlaceCheckedOutOrder.command.ts";
import { Checkout } from "./Checkout.ts";

/** One durable fulfillment per order, even when a confirmation is delivered again. */
export class FulfillCheckout extends Domain.Saga("FulfillCheckout", {
  key: OrderId,
  input: { customerId: CustomerId, customerName: CustomerName, checkout: Checkout },
}) {}

export const FulfillCheckoutLive = FulfillCheckout.toLayer(
  Effect.gen(function* () {
    const orders = yield* Order;
    // The payload is annotated so type-aware lint can resolve the handler's input.
    return Effect.fn("FulfillCheckout.run")(function* ({
      key,
      customerId,
      customerName,
      checkout,
    }: typeof FulfillCheckout.workflow.payloadSchema.Type) {
      yield* Activity.make({
        name: "PlaceCheckedOutOrder",
        execute: orders
          .send(key, new PlaceCheckedOutOrder({ customerId, customerName, checkout }))
          .pipe(Effect.asVoid),
      });
    });
  }),
);
