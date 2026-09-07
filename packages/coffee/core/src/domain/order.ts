/**
 * Defines Coffee order, order item, status, and transition rules.
 *
 * @module
 */
import { makeTypeId, type TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";
import { DrinkId, DrinkSize, Milk, Temperature } from "./menu.ts";
import { Money } from "./money.ts";
import { CustomerName, Quantity, ShotCount } from "./order-primitives.ts";
import { typeId } from "./typed-id.ts";

export const orderStatuses = ["pending", "brewing", "ready", "picked-up", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const OrderStatus = Schema.Literals(orderStatuses);

export const OrderIdFactory = makeTypeId("order", { brand: "OrderId" });
export type OrderId = TypeIdFrom<typeof OrderIdFactory>;
export const OrderId = typeId(OrderIdFactory).annotate({ identifier: "OrderId" });
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const orderIdFromString = Schema.decodeUnknownSync(OrderId);

const OptionalString = Schema.OptionFromOptionalKey(Schema.String);

export const CoffeeOrderItem = Schema.Struct({
  drinkId: DrinkId,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: ShotCount,
  notes: OptionalString,
  quantity: Quantity,
  unitPrice: Money,
  lineTotal: Money,
}).annotate({ identifier: "CoffeeOrderItem" });
export type CoffeeOrderItem = typeof CoffeeOrderItem.Type;

export const CoffeeOrder = Schema.Struct({
  id: OrderId,
  customerName: CustomerName,
  ownerUserId: Schema.String,
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  status: OrderStatus,
  totalPrice: Money,
  createdAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CoffeeOrder" });
export type CoffeeOrder = typeof CoffeeOrder.Type;

export const CoffeeOrders = Schema.Array(CoffeeOrder).annotate({
  identifier: "CoffeeOrders",
});
export type CoffeeOrders = typeof CoffeeOrders.Type;

export interface ListOrdersFilters {
  readonly ownerUserId?: string;
  readonly status?: OrderStatus;
}

export const isOrderStatus = Schema.is(OrderStatus);

const validTransitions: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
};

export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean =>
  validTransitions[from].some((nextStatus) => nextStatus === to);
