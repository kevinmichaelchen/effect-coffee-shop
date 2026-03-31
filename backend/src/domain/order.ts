import * as Schema from "effect/Schema";
import { DrinkIdSchema, DrinkSizeSchema, MilkSchema, TemperatureSchema } from "./menu.ts";

export const orderStatuses = ["pending", "brewing", "ready", "picked-up", "cancelled"] as const;
export type OrderStatus = (typeof orderStatuses)[number];
export const OrderStatusSchema = Schema.Literals(orderStatuses);

const orderIdPattern = /^order-\d+$/;

export const OrderIdSchema = Schema.String.check(Schema.isPattern(orderIdPattern)).annotate({
  identifier: "OrderId",
});
export type OrderId = typeof OrderIdSchema.Type;

export const CoffeeOrderSchema = Schema.Struct({
  id: OrderIdSchema,
  customerName: Schema.String,
  drinkId: DrinkIdSchema,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optionalKey(Schema.String),
  status: OrderStatusSchema,
  priceCents: Schema.Int,
  createdAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CoffeeOrder" });
export type CoffeeOrder = typeof CoffeeOrderSchema.Type;

export const CoffeeOrdersSchema = Schema.Array(CoffeeOrderSchema).annotate({
  identifier: "CoffeeOrders",
});
export type CoffeeOrders = typeof CoffeeOrdersSchema.Type;

export interface ListOrdersFilters {
  readonly status?: OrderStatus;
}

const matches = <T extends string>(choices: readonly T[], value: string): value is T =>
  choices.some((choice) => choice === value);

export const isOrderStatus = (value: string): value is OrderStatus => matches(orderStatuses, value);

const validTransitions: Record<OrderStatus, ReadonlyArray<OrderStatus>> = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
};

export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean =>
  validTransitions[from].some((nextStatus) => nextStatus === to);
