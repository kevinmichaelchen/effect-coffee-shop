import * as Schema from "effect/Schema";
import { drinkSizes, milks, orderStatuses, temperatures } from "./coffee.ts";

const DrinkSize = Schema.Literals(drinkSizes);
const Milk = Schema.Literals(milks);
const Temperature = Schema.Literals(temperatures);
const OrderStatus = Schema.Literals(orderStatuses);

const MenuItem = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  kind: Schema.Literals(["espresso", "tea"] as const),
  basePriceCents: Schema.Int,
  availableMilks: Schema.Array(Milk),
  availableTemperatures: Schema.Array(Temperature),
  maxShots: Schema.Int,
});

const CoffeeOrderItem = Schema.Struct({
  drinkId: Schema.String,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: Schema.Int,
  notes: Schema.optional(Schema.String),
  quantity: Schema.Int,
  unitPriceCents: Schema.Int,
  lineTotalCents: Schema.Int,
});

// Optional keys match the domain's `DrinkSelection`, so a request passes through as is.
const DrinkSelection = Schema.Struct({
  drinkId: Schema.String,
  size: DrinkSize,
  milk: Schema.optionalKey(Milk),
  temperature: Schema.optionalKey(Temperature),
  shots: Schema.optionalKey(Schema.Int),
  notes: Schema.optionalKey(Schema.String),
  quantity: Schema.optionalKey(Schema.Int),
});

const PlaceOrderRequest = Schema.Struct({
  items: Schema.Array(DrinkSelection),
});

/** An order as the components render it: cents and an ISO timestamp. */
const OrderTicket = Schema.Struct({
  id: Schema.String,
  customerName: Schema.String,
  ownerUserId: Schema.String,
  items: Schema.Array(CoffeeOrderItem),
  status: OrderStatus,
  totalPriceCents: Schema.Int,
  createdAt: Schema.String,
});

export const CoffeeApiError = Schema.Struct({
  _tag: Schema.optional(Schema.String),
  message: Schema.optional(Schema.String),
});

export const Menu = Schema.Array(MenuItem);

export type MenuItem = typeof MenuItem.Type;
export type OrderTicket = typeof OrderTicket.Type;
export type PlaceOrderRequest = typeof PlaceOrderRequest.Type;
export type CoffeeApiError = typeof CoffeeApiError.Type;
