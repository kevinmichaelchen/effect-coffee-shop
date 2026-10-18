import * as Domain from "alchemy/Domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { isStaff } from "../Actor.ts";
import { CurrentActor } from "../CurrentActor.context.ts";
import { Session } from "../Session.middleware.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { NotYourOrder } from "./NotYourOrder.rejection.ts";
import { Order } from "./Order.aggregate.ts";
import type { OrderStatus } from "./OrderStatus.ts";

const Summary = Schema.Struct({ order: Schema.NullOr(CoffeeOrder) });
type Summary = typeof Summary.Type;

const withStatus = (summary: Summary, status: OrderStatus): Summary =>
  summary.order === null ? summary : { order: { ...summary.order, status } };

/**
 * One order as a ticket: what was ordered, by whom, and where it is now.
 * Staff may read any ticket; a customer only their own.
 */
export class OrderSummary extends Domain.View("OrderSummary", {
  from: [Order],
  key: Order,
  middleware: [Session],
  rejects: [NotYourOrder],
  state: Summary,
  initial: { order: null },
  evolve: {
    OrderPlaced: (_, event, { key, at }) => ({
      order: {
        id: key.id,
        customerName: event.customerName,
        ownerUserId: event.customerId,
        items: event.items,
        status: "pending" as const,
        totalPrice: event.totalPrice,
        createdAt: at,
      },
    }),
    BrewingStarted: (summary) => withStatus(summary, "brewing"),
    OrderReady: (summary) => withStatus(summary, "ready"),
    OrderPickedUp: (summary) => withStatus(summary, "picked-up"),
    OrderCancelled: (summary) => withStatus(summary, "cancelled"),
  },
  validate: Effect.fn(function* (_request, summary) {
    const actor = yield* CurrentActor;
    const owner = summary?.order?.ownerUserId;
    if (isStaff(actor) || owner === undefined || owner === actor.userId) return;
    return yield* new NotYourOrder();
  }),
}) {}
