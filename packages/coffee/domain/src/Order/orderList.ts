import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Order from "effect/Order";
import type { CoffeeOrder } from "./CoffeeOrder.ts";

const byPlacement = Order.mapInput(DateTime.Order, (order: CoffeeOrder) => order.createdAt);

/** Replace the order with the same id, or add it, keeping the list in placement order. */
export const upsertOrder = (
  orders: ReadonlyArray<CoffeeOrder>,
  order: CoffeeOrder,
): ReadonlyArray<CoffeeOrder> =>
  Arr.sort(
    Arr.append(
      Arr.filter(orders, (existing) => existing.id !== order.id),
      order,
    ),
    byPlacement,
  );
