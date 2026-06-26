/**
 * Defines Coffee order, order item, status, and transition rules.
 *
 * @module
 */
import { makeTypeId, type TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";
import { DrinkIdSchema, DrinkSizeSchema, MilkSchema, TemperatureSchema } from "./menu.ts";
import { MoneySchema } from "./money.ts";
import { CustomerNameSchema, QuantitySchema, ShotCountSchema } from "./order-primitives.ts";
import { makeTypeIdSchema } from "./typed-id.ts";

export const orderStatuses = ["pending", "brewing", "ready", "picked-up", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const OrderStatusSchema = Schema.Literals(orderStatuses);

export const OrderIdFactory = makeTypeId("order", { brand: "OrderId" });
export type OrderId = TypeIdFrom<typeof OrderIdFactory>;
export const OrderIdSchema = makeTypeIdSchema(OrderIdFactory).annotate({ identifier: "OrderId" });
export const orderIdFromString = Schema.decodeUnknownSync(OrderIdSchema);

const OptionalStringSchema = Schema.OptionFromOptionalKey(Schema.String);

export const CoffeeOrderItemSchema = Schema.Struct({
  drinkId: DrinkIdSchema,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: ShotCountSchema,
  notes: OptionalStringSchema,
  quantity: QuantitySchema,
  unitPrice: MoneySchema,
  lineTotal: MoneySchema,
}).annotate({ identifier: "CoffeeOrderItem" });
export type CoffeeOrderItem = typeof CoffeeOrderItemSchema.Type;

export const CoffeeOrderSchema = Schema.Struct({
  id: OrderIdSchema,
  customerName: CustomerNameSchema,
  ownerUserId: Schema.String,
  items: Schema.NonEmptyArray(CoffeeOrderItemSchema),
  status: OrderStatusSchema,
  totalPrice: MoneySchema,
  createdAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CoffeeOrder" });
export type CoffeeOrder = typeof CoffeeOrderSchema.Type;

export const CoffeeOrdersSchema = Schema.Array(CoffeeOrderSchema).annotate({
  identifier: "CoffeeOrders",
});
export type CoffeeOrders = typeof CoffeeOrdersSchema.Type;

export interface ListOrdersFilters {
  readonly ownerUserId?: string;
  readonly status?: OrderStatus;
}

export const isOrderStatus = Schema.is(OrderStatusSchema);

const validTransitions: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
};

export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean =>
  validTransitions[from].some((nextStatus) => nextStatus === to);
