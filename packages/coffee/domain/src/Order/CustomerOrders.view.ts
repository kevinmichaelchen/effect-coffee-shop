import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { isStaff } from "../Actor.ts";
import { CurrentActor } from "../CurrentActor.context.ts";
import { Customer } from "../Customer/Customer.aggregate.ts";
import { Session } from "../Session.middleware.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { NotYourOrder } from "./NotYourOrder.rejection.ts";
import { upsertOrder } from "./orderList.ts";
import { OrderSummary } from "./OrderSummary.view.ts";

/**
 * Every order one customer has placed, oldest first, built from each ticket's
 * summary. Keyed by customer, so the key alone decides who may read it.
 */
export class CustomerOrders extends Domain.View("CustomerOrders", {
  from: [OrderSummary],
  key: Customer,
  middleware: [Session],
  rejects: [NotYourOrder],
  keyOf: {
    OrderSummary: ({ state }) => (state?.order ? Customer.ref(state.order.ownerUserId) : undefined),
  },
  state: Schema.Struct({ orders: Schema.Array(CoffeeOrder) }),
  initial: { orders: [] },
  evolve: {
    OrderSummary: (view, _, { state }) =>
      state?.order ? { orders: upsertOrder(view.orders, state.order) } : view,
  },
  validate: Effect.fn(function* (request) {
    const actor = yield* CurrentActor;
    if (isStaff(actor) || request.key.id === actor.userId) return;
    return yield* new NotYourOrder();
  }),
}) {}
