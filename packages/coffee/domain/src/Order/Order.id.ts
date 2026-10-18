import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { generateTypedId, typedIdPattern } from "../TypedId.ts";

/** A ticket, such as `order_01j9z3k6a0x8s5v2c4b7n1m3p6`. */
export const OrderId = Schema.String.check(typedIdPattern("order"))
  .pipe(Schema.brand("OrderId"))
  .annotate({
    identifier: "OrderId",
    description: "Coffee shop ticket id, such as order_01j9z3k6a0x8s5v2c4b7n1m3p6.",
  });
export type OrderId = typeof OrderId.Type;

/** A new ticket id, made by whoever places the order. */
export const makeOrderId = generateTypedId("order").pipe(Effect.map((id) => OrderId.make(id)));
