import * as Arr from "effect/Array";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { isStaff } from "../Actor.ts";
import { CurrentActor } from "../CurrentActor.context.ts";
import { Session } from "../Session.middleware.ts";
import { mainShop, Shop } from "../Shop/Shop.aggregate.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { upsertOrder } from "./orderList.ts";
import { isOpen } from "./OrderStatus.ts";
import { OrderSummary } from "./OrderSummary.view.ts";

/** Finished orders the queue keeps for its history, newest first. */
const queueHistoryLimit = 200;

const trimHistory = (orders: ReadonlyArray<CoffeeOrder>): ReadonlyArray<CoffeeOrder> => {
  const kept = Arr.takeRight(
    Arr.filter(orders, (order) => !isOpen(order.status)),
    queueHistoryLimit,
  ).map((order) => order.id);
  return Arr.filter(orders, (order) => isOpen(order.status) || Arr.contains(kept, order.id));
};

/**
 * The shop's queue for the baristas: every open order, and the most recent
 * finished ones, in placement order. Staff only.
 */
export class OrderQueue extends Domain.View("OrderQueue", {
  from: [OrderSummary],
  key: Shop,
  middleware: [Session],
  rejects: [StaffOnly],
  keyOf: { OrderSummary: () => Shop.ref(mainShop) },
  state: Schema.Struct({ orders: Schema.Array(CoffeeOrder) }),
  initial: { orders: [] },
  evolve: {
    OrderSummary: (queue, _, { state }) =>
      state?.order ? { orders: trimHistory(upsertOrder(queue.orders, state.order)) } : queue,
  },
  validate: () =>
    CurrentActor.pipe(
      Effect.filterOrFail(isStaff, () => new StaffOnly()),
      Effect.asVoid,
    ),
}) {}
