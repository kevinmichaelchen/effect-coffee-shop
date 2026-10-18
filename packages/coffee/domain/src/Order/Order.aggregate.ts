import * as Domain from "alchemy/Domain";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { type Actor, isStaff } from "../Actor.ts";
import { CurrentActor } from "../CurrentActor.context.ts";
import { quoteOrder } from "../Menu/OrderItem.ts";
import { customerNameFor } from "../customerName.ts";
import { invariantViolated } from "../Invariant.ts";
import { StaffOnly } from "../StaffOnly.rejection.ts";
import { BrewingStarted, StartBrewing } from "./StartBrewing.command.ts";
import { CancelOrder, OrderCancelled } from "./CancelOrder.command.ts";
import { CoffeeOrder } from "./CoffeeOrder.ts";
import { InvalidStatusTransition } from "./InvalidStatusTransition.rejection.ts";
import { MarkReady, OrderReady } from "./MarkReady.command.ts";
import { OrderId } from "./Order.id.ts";
import { OrderNotFound } from "./OrderNotFound.rejection.ts";
import { canTransitionTo, type OrderStatus } from "./OrderStatus.ts";
import { OrderPickedUp, PickUpOrder } from "./PickUpOrder.command.ts";
import { PlaceCheckedOutOrder } from "./PlaceCheckedOutOrder.command.ts";
import { AlreadyPlaced, OrderPlaced, PlaceOrder } from "./PlaceOrder.command.ts";

const Placed = Schema.TaggedStruct("Placed", { order: CoffeeOrder });
const OrderState = Schema.Union([Schema.TaggedStruct("Unplaced", {}), Placed]);
type OrderState = typeof OrderState.Type;
type Placed = typeof Placed.Type;

/** A barista moves a placed order one step along its lifecycle. */
const moveTo =
  <E>(to: OrderStatus, recorded: (by: Actor) => E) =>
  (
    state: OrderState,
    _command: StartBrewing | MarkReady | PickUpOrder | CancelOrder,
    { id }: { readonly id: OrderId },
  ) =>
    Effect.gen(function* () {
      const actor = yield* CurrentActor;
      if (!isStaff(actor)) return yield* new StaffOnly();
      const placed = yield* Match.value(state).pipe(
        Match.tag("Unplaced", () => Effect.fail(new OrderNotFound({ orderId: id }))),
        Match.tag("Placed", (placed: Placed) => Effect.succeed(placed)),
        Match.exhaustive,
      );
      const from = placed.order.status;
      if (!canTransitionTo(from, to)) {
        return yield* new InvalidStatusTransition({ orderId: id, from, to });
      }
      return [recorded(actor)];
    });

const withStatus = (state: OrderState, status: OrderStatus): OrderState =>
  Match.value(state).pipe(
    Match.tag("Placed", (placed): OrderState => ({
      ...placed,
      order: { ...placed.order, status },
    })),
    Match.orElse(() => state),
  );

// Replies follow an accepted command, so the order exists.
const placedOrder = (state: OrderState) =>
  Match.value(state).pipe(
    Match.tag("Placed", (placed: Placed) => ({ order: placed.order })),
    Match.orElse(() => invariantViolated("An order reply requires a placed order")),
  );

/**
 * One ticket: placed once, then moved along its lifecycle by the baristas.
 * Each command lives in its own file with the events it records; this file
 * holds the state and how commands and events change it.
 */
export class Order extends Domain.Aggregate("Order", {
  id: OrderId,
  state: OrderState,
  initial: { _tag: "Unplaced" },
  commands: [PlaceOrder, PlaceCheckedOutOrder, StartBrewing, MarkReady, PickUpOrder, CancelOrder],
  decide: {
    PlaceOrder: Effect.fn(function* (state, command, { id }) {
      if (Schema.is(Placed)(state)) return yield* new AlreadyPlaced({ orderId: id });
      const actor = yield* CurrentActor;
      const customerName = yield* customerNameFor(
        actor,
        Option.fromUndefinedOr(command.customerName),
      );
      const quote = yield* Effect.fromResult(quoteOrder(command.items));
      return [
        new OrderPlaced({
          customerId: actor.userId,
          customerName,
          items: quote.items,
          totalPrice: quote.totalPrice,
        }),
      ];
    }),
    PlaceCheckedOutOrder: (state, command) =>
      Schema.is(Placed)(state)
        ? []
        : [
            new OrderPlaced({
              customerId: command.customerId,
              customerName: command.customerName,
              items: command.checkout.items,
              totalPrice: command.checkout.totalPrice,
            }),
          ],
    StartBrewing: moveTo("brewing", (by) => new BrewingStarted({ by })),
    MarkReady: moveTo("ready", (by) => new OrderReady({ by })),
    PickUpOrder: moveTo("picked-up", (by) => new OrderPickedUp({ by })),
    CancelOrder: moveTo("cancelled", (by) => new OrderCancelled({ by })),
  },
  evolve: {
    OrderPlaced: (_, event, envelope) => ({
      _tag: "Placed" as const,
      order: {
        id: envelope.id,
        customerName: event.customerName,
        ownerUserId: event.customerId,
        items: event.items,
        status: "pending" as const,
        totalPrice: event.totalPrice,
        createdAt: envelope.at,
      },
    }),
    BrewingStarted: (state) => withStatus(state, "brewing"),
    OrderReady: (state) => withStatus(state, "ready"),
    OrderPickedUp: (state) => withStatus(state, "picked-up"),
    OrderCancelled: (state) => withStatus(state, "cancelled"),
  },
  reply: {
    PlaceOrder: placedOrder,
    StartBrewing: placedOrder,
    MarkReady: placedOrder,
    PickUpOrder: placedOrder,
    CancelOrder: placedOrder,
  },
}) {}
