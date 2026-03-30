import * as Schema from "effect/Schema";
import { drinkIds, drinkSizes, milks, temperatures } from "#domain/menu";
import { orderStatuses } from "#domain/order";

const quoteUnion = (values: ReadonlyArray<string>): string =>
  values.map((value) => JSON.stringify(value)).join(" | ");

export const CodeModeSuccessSchema = Schema.Struct({
  result: Schema.Json,
  logs: Schema.Array(Schema.String),
}).annotate({ identifier: "CodeModeSuccess" });

export const CodeModeFailureSchema = Schema.Struct({
  error: Schema.Json,
  logs: Schema.Array(Schema.String),
}).annotate({ identifier: "CodeModeFailure" });

export type CodeModeFailure = typeof CodeModeFailureSchema.Type;

const CoffeeCodeModeTypes = `
type OrderId = string; // Pattern: order-<digits>
type OrderStatus = ${quoteUnion(orderStatuses)};
type DrinkId = ${quoteUnion(drinkIds)};
type DrinkSize = ${quoteUnion(drinkSizes)};
type Milk = ${quoteUnion(milks)};
type Temperature = ${quoteUnion(temperatures)};

type MenuItem = {
  id: DrinkId;
  name: string;
  kind: "espresso" | "tea";
  basePriceCents: number;
  availableMilks: Array<Milk>;
  availableTemperatures: Array<Temperature>;
  maxShots: number;
};

type Menu = Array<MenuItem>;

type PlaceOrderRequest = {
  customerName: string;
  drinkId: DrinkId;
  size: DrinkSize;
  milk?: Milk;
  temperature?: Temperature;
  shots?: number;
  notes?: string;
};

type CoffeeOrder = {
  id: OrderId;
  customerName: string;
  drinkId: DrinkId;
  drinkName: string;
  size: DrinkSize;
  milk: Milk;
  temperature: Temperature;
  shots: number;
  notes?: string;
  status: OrderStatus;
  priceCents: number;
  createdAt: string; // ISO-8601 UTC timestamp
};

type AppError =
  | { _tag: "DrinkNotFoundError"; drinkId: string }
  | { _tag: "InvalidOrderInputError"; message: string }
  | { _tag: "OrderNotFoundError"; orderId: OrderId }
  | { _tag: "InvalidOrderStatusTransitionError"; orderId: OrderId; from: OrderStatus; to: OrderStatus }
  | { _tag: "CodeModeArgumentsError"; message: string }
  | { _tag: "CodeModeExecutionError"; message: string };

declare const codemode: {
  list_menu(): Promise<Menu>;
  place_order(input: PlaceOrderRequest): Promise<CoffeeOrder>;
  get_order(input: { orderId: OrderId }): Promise<CoffeeOrder>;
  list_orders(input?: { status?: OrderStatus }): Promise<Array<CoffeeOrder>>;
  start_brewing(input: { orderId: OrderId }): Promise<CoffeeOrder>;
  mark_ready(input: { orderId: OrderId }): Promise<CoffeeOrder>;
  pick_up_order(input: { orderId: OrderId }): Promise<CoffeeOrder>;
  cancel_order(input: { orderId: OrderId }): Promise<CoffeeOrder>;
};
`;

export const CoffeeCodeModeDescription = `Execute coffee-order workflows as JavaScript code.

Available:
${CoffeeCodeModeTypes}

Write an async arrow function in JavaScript that returns the final result.
Do not use TypeScript syntax.
Console output is captured and returned in the logs array.

Example:
async () => {
  const menu = await codemode.list_menu();
  const latte = menu.find((item) => item.id === "latte");
  if (!latte) {
    throw { _tag: "CodeModeExecutionError", message: "Latte is missing from the menu" };
  }

  const created = await codemode.place_order({
    customerName: "Avery",
    drinkId: latte.id,
    size: "medium",
  });

  console.log("created", created.id);
  return created;
}`;
