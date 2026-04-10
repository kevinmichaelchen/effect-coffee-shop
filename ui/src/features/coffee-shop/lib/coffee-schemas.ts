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

export const CoffeeOrderSchema = Schema.Struct({
  id: Schema.String,
  customerName: Schema.String,
  drinkId: Schema.String,
  drinkName: Schema.String,
  size: DrinkSizeSchema,
  milk: MilkSchema,
  temperature: TemperatureSchema,
  shots: Schema.Int,
  notes: Schema.optional(Schema.String),
  status: OrderStatusSchema,
  priceCents: Schema.Int,
  createdAt: Schema.String,
});

export const CoffeeApiErrorSchema = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});

export const MenuSchema = Schema.Array(MenuItemSchema);
export const CoffeeOrdersSchema = Schema.Array(CoffeeOrderSchema);
