import * as Schema from "effect/Schema";
import { CustomerId } from "../Customer/Customer.id.ts";
import { CoffeeOrderItem } from "../Menu/OrderItem.ts";
import { CustomerName } from "../Menu/OrderPrimitives.ts";
import { Money } from "../Money.ts";
import { OrderId } from "./Order.id.ts";
import { OrderStatus } from "./OrderStatus.ts";

/** A placed order, as the shop and its customer see it. */
export const CoffeeOrder = Schema.Struct({
  id: OrderId,
  customerName: CustomerName,
  ownerUserId: CustomerId,
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  status: OrderStatus,
  totalPrice: Money,
  createdAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CoffeeOrder" });
export type CoffeeOrder = typeof CoffeeOrder.Type;
