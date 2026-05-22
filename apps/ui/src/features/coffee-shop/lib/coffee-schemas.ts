import * as Schema from "effect/Schema";
import { drinkSizes, milks, orderStatuses, temperatures } from "./coffee.ts";

const DrinkSizeSchema = Schema.Literals(drinkSizes);
const MilkSchema = Schema.Literals(milks);
const TemperatureSchema = Schema.Literals(temperatures);
const OrderStatusSchema = Schema.Literals(orderStatuses);

const MenuItemSchema = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(["espresso", "tea"] as const),
  basePriceCents: Schema.Int,
  availableMilks: Schema.Array(MilkSchema),
  availableTemperatures: Schema.Array(TemperatureSchema),
  maxShots: Schema.Int,
});

const CoffeeOrderItemSchema = Schema.Struct({
  drinkId: Schema.String,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optional(Schema.String),
  quantity: Schema.Int,
  unitPriceCents: Schema.Int,
  lineTotalCents: Schema.Int,
});

const OrderItemRequestSchema = Schema.Struct({
  drinkId: Schema.String,
  size: DrinkSizeSchema,
  milk: Schema.optional(MilkSchema),
  temperature: Schema.optional(TemperatureSchema),
  shots: Schema.optional(Schema.Int),
  notes: Schema.optional(Schema.String),
  quantity: Schema.optional(Schema.Int),
});

export const PlaceOrderRequestSchema = Schema.Struct({
  items: Schema.Array(OrderItemRequestSchema),
});

export const CoffeeOrderSchema = Schema.Struct({
  id: Schema.String,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  items: Schema.Array(CoffeeOrderItemSchema),
  status: OrderStatusSchema,
  totalPriceCents: Schema.Int,
  createdAt: Schema.String,
});

export const CoffeeApiErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});

export const MenuSchema = Schema.Array(MenuItemSchema);
export const CoffeeOrdersSchema = Schema.Array(CoffeeOrderSchema);

export type MenuItem = typeof MenuItemSchema.Type;
export type CoffeeOrder = typeof CoffeeOrderSchema.Type;
export type PlaceOrderRequest = typeof PlaceOrderRequestSchema.Type;
export type CoffeeApiError = typeof CoffeeApiErrorSchema.Type;
