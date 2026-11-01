import { assert, describe, expect, it } from "@effect/vitest";
import { Story } from "@alchemy.run/domain/Story";
import { Machine } from "@typeonce/effect-machine";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import type { Actor } from "../src/Actor.ts";
import { AddCartItem } from "../src/Cart/AddCartItem.command.ts";
import { Cart } from "../src/Cart/Cart.aggregate.ts";
import { CartItemId } from "../src/Cart/CartItem.id.ts";
import { CheckoutId } from "../src/Cart/Checkout.ts";
import { FulfillCheckout } from "../src/Cart/FulfillCheckout.saga.ts";
import { CheckoutPrepared, PrepareCheckout } from "../src/Cart/PrepareCheckout.command.ts";
import { ConfirmCheckout } from "../src/Cart/ConfirmCheckout.command.ts";
import { CoffeeShop, CoffeeShopHandlers } from "../src/CoffeeShop.model.ts";
import { CurrentActor } from "../src/CurrentActor.context.ts";
import { CustomerId } from "../src/Customer/Customer.id.ts";
import { type CoffeeOrderItem, priceOrderItem } from "../src/Menu/OrderItem.ts";
import { CustomerName } from "../src/Menu/OrderPrimitives.ts";
import { CancelOrder, OrderCancelled } from "../src/Order/CancelOrder.command.ts";
import { InvalidStatusTransition } from "../src/Order/InvalidStatusTransition.rejection.ts";
import { MarkReady, OrderReady } from "../src/Order/MarkReady.command.ts";
import { Order } from "../src/Order/Order.aggregate.ts";
import { OrderId } from "../src/Order/Order.id.ts";
import { OrderNotFound } from "../src/Order/OrderNotFound.rejection.ts";
import { canTransitionTo, type OrderStatus, orderStatuses } from "../src/Order/OrderStatus.ts";
import { OrderPickedUp, PickUpOrder } from "../src/Order/PickUpOrder.command.ts";
import { OrderPlaced } from "../src/Order/PlaceOrder.command.ts";
import { BrewingStarted, StartBrewing } from "../src/Order/StartBrewing.command.ts";

// A test-only model of the Order lifecycle, kept in step with the aggregate:
// the event log stays authoritative and the chart only interprets committed
// facts. There is no second region to model in parallel: a ticket's lifecycle
// is one sequence, and checkout fulfillment is a saga, not a chart region.

const OrderChartEvents = Machine.events({
  OrderPlaced: {},
  BrewingStarted: {},
  OrderReady: {},
  OrderPickedUp: {},
  OrderCancelled: {},
});

const OrderStates = Machine.state({
  states: {
    Unplaced: {},
    Pending: {},
    Brewing: {},
    Ready: {},
    PickedUp: { type: "final" },
    Cancelled: { type: "final" },
  },
});

const OrderChart = Machine.make({
  id: "OrderLifecycle",
  root: OrderStates,
  events: OrderChartEvents,
}).handle({
  initial: { target: "Unplaced" },
  states: {
    Unplaced: { on: { OrderPlaced: { target: "Pending" } } },
    Pending: {
      on: { BrewingStarted: { target: "Brewing" }, OrderCancelled: { target: "Cancelled" } },
    },
    Brewing: { on: { OrderReady: { target: "Ready" }, OrderCancelled: { target: "Cancelled" } } },
    Ready: { on: { OrderPickedUp: { target: "PickedUp" } } },
  },
});

type Chart = Machine.Snapshot<typeof OrderChart>;

/** The facts the Order aggregate records about one ticket. */
type OrderFact = OrderPlaced | BrewingStarted | OrderReady | OrderPickedUp | OrderCancelled;

/** Where a recorded fact leaves the ticket: total over the fact tags. */
const statusOfFact = (fact: OrderFact): OrderStatus =>
  Match.value(fact).pipe(
    Match.tag("OrderPlaced", (): OrderStatus => "pending"),
    Match.tag("BrewingStarted", (): OrderStatus => "brewing"),
    Match.tag("OrderReady", (): OrderStatus => "ready"),
    Match.tag("OrderPickedUp", (): OrderStatus => "picked-up"),
    Match.tag("OrderCancelled", (): OrderStatus => "cancelled"),
    Match.exhaustive,
  );

/** The chart event that moves a ticket into a status: total over the statuses. */
const eventFor = (to: OrderStatus) =>
  Match.value(to).pipe(
    Match.when("pending", () => OrderChartEvents.OrderPlaced()),
    Match.when("brewing", () => OrderChartEvents.BrewingStarted()),
    Match.when("ready", () => OrderChartEvents.OrderReady()),
    Match.when("picked-up", () => OrderChartEvents.OrderPickedUp()),
    Match.when("cancelled", () => OrderChartEvents.OrderCancelled()),
    Match.exhaustive,
  );

const chartStatuses: ReadonlyArray<{
  readonly state: "Pending" | "Brewing" | "Ready" | "PickedUp" | "Cancelled";
  readonly status: OrderStatus;
}> = [
  { state: "Pending", status: "pending" },
  { state: "Brewing", status: "brewing" },
  { state: "Ready", status: "ready" },
  { state: "PickedUp", status: "picked-up" },
  { state: "Cancelled", status: "cancelled" },
];

/** The lifecycle status a chart snapshot stands for, if the ticket was placed. */
const statusOfChart = (chart: Chart): Option.Option<OrderStatus> =>
  Option.map(
    Option.fromUndefinedOr(
      chartStatuses.find(({ state: chartState }) => OrderStates.matches(chart, chartState)),
    ),
    ({ status }) => status,
  );

/**
 * Decide a lifecycle move on the chart. `Machine.plan` silently ignores an
 * event no state handles, so every move is gated on `Machine.can` first and an
 * unhandled move is refused with the rejection the aggregate itself raises.
 */
const decideWithChart = (orderId: OrderId, chart: Chart, to: OrderStatus) =>
  Effect.gen(function* () {
    if (yield* Machine.can(OrderChart, chart, eventFor(to))) return;
    return yield* Option.match(statusOfChart(chart), {
      onNone: () => new OrderNotFound({ orderId }),
      onSome: (from) => new InvalidStatusTransition({ orderId, from, to }),
    });
  });

/** Fold recorded facts through the chart, in order. */
const replay = (orderId: OrderId, facts: ReadonlyArray<OrderFact>) =>
  Effect.flatMap(Machine.planInitial(OrderChart), ({ state: start }) =>
    Effect.reduce(
      facts,
      () => start,
      (chart, fact) =>
        Effect.gen(function* () {
          const to = statusOfFact(fact);
          yield* decideWithChart(orderId, chart, to);
          return (yield* Machine.plan(OrderChart, chart, eventFor(to))).next;
        }),
    ),
  );

const story = Story.make(CoffeeShop, { layer: CoffeeShopHandlers });
const { clock, given, provide, rejected, replied, state, then, when } = Story;

/** Act as this actor for the following commands, as their session middleware would. */
const as = (actor: Actor) => provide(CurrentActor, actor);

const person = (kind: Actor["kind"], userId: string, displayName: string): Actor => ({
  kind,
  userId: CustomerId.make(userId),
  displayName,
});
const sam = person("customer", "user-sam", "Sam");
const barista = person("staff", "user-bo", "Bo");

const id = (prefix: string, n: number) => `${prefix}_${"0".repeat(25)}${n}`;
const orderRef = (n: number) => Order.ref(OrderId.make(id("order", n)));
const cartItem = (n: number) => CartItemId.make(id("cart_item", n));
const checkoutId = (n: number) => CheckoutId.make(id("checkout_session", n));

const priced = (request: Parameters<typeof priceOrderItem>[0]): CoffeeOrderItem =>
  Result.match(priceOrderItem(request), {
    onSuccess: (item) => item,
    onFailure: (failure) => assert.fail(`fixture does not price: ${failure._tag}`),
  });

const latte = priced({ drinkId: "latte", size: "medium", milk: "oat" });
const placedAt = "2026-10-18T09:00:00.000Z";

const samPlaced = new OrderPlaced({
  customerId: sam.userId,
  customerName: CustomerName.make("Sam"),
  items: [latte],
  totalPrice: latte.lineTotal,
});

const brewed = new BrewingStarted({ by: barista });
const ready = new OrderReady({ by: barista });
const pickedUp = new OrderPickedUp({ by: barista });
const cancelled = new OrderCancelled({ by: barista });

/** The facts that leave a ticket in a status, for building a chart snapshot. */
const historyTo = (status: OrderStatus): ReadonlyArray<OrderFact> =>
  Match.value(status).pipe(
    Match.when("pending", () => [samPlaced]),
    Match.when("brewing", () => [samPlaced, brewed]),
    Match.when("ready", () => [samPlaced, brewed, ready]),
    Match.when("picked-up", () => [samPlaced, brewed, ready, pickedUp]),
    Match.when("cancelled", () => [samPlaced, cancelled]),
    Match.exhaustive,
  );

describe("order lifecycle chart", () => {
  it.effect("accepts exactly the moves the lifecycle table allows", () =>
    Effect.gen(function* () {
      const o1 = orderRef(1);
      const cells = yield* Effect.forEach(
        orderStatuses,
        (from) =>
          Effect.flatMap(replay(o1.id, historyTo(from)), (chart) => {
            expect(Option.getOrNull(statusOfChart(chart))).toBe(from);
            return Effect.forEach(
              orderStatuses,
              (to) =>
                Effect.map(Effect.result(decideWithChart(o1.id, chart, to)), (decision) => ({
                  from,
                  to,
                  accepted: Result.isSuccess(decision),
                })),
              { concurrency: 1 },
            );
          }),
        { concurrency: 1 },
      );
      expect(cells.flat()).toEqual(
        orderStatuses.flatMap((from) =>
          orderStatuses.map((to) => ({ from, to, accepted: canTransitionTo(from, to) })),
        ),
      );
    }),
  );

  it.effect("refuses a skipped move with the aggregate's own rejection", () => {
    const o1 = orderRef(1);
    const refusal = new InvalidStatusTransition({ orderId: o1.id, from: "pending", to: "ready" });
    return Effect.gen(function* () {
      const chart = yield* replay(o1.id, historyTo("pending"));
      expect(yield* Effect.flip(decideWithChart(o1.id, chart, "ready"))).toEqual(refusal);
      yield* story(
        given(o1, samPlaced),
        as(barista),
        when(o1, new MarkReady()),
        rejected(refusal),
        then(o1),
      );
    });
  });

  it.effect("refuses facts for a ticket that was never placed", () =>
    Effect.gen(function* () {
      const o1 = orderRef(1);
      expect(yield* Effect.flip(replay(o1.id, [brewed]))).toEqual(
        new OrderNotFound({ orderId: o1.id }),
      );
    }),
  );
});

describe("replaying real histories", () => {
  // Story asserts committed events with `then(...)` but returns nothing, so a
  // test folds the same event instances it asserts: the story proves they are
  // exactly what the aggregate recorded.
  it.effect("reaches the aggregate's status for a picked-up order", () => {
    const o1 = orderRef(1);
    const history: ReadonlyArray<OrderFact> = [samPlaced, brewed, ready, pickedUp];
    return Effect.gen(function* () {
      const chartStatus = Option.getOrNull(statusOfChart(yield* replay(o1.id, history)));
      expect(chartStatus).toBe("picked-up");
      yield* story(
        given(o1, samPlaced),
        as(barista),
        when(o1, new StartBrewing()),
        when(o1, new MarkReady()),
        when(o1, new PickUpOrder()),
        then(o1, brewed, ready, pickedUp),
        state(o1, (order) => expect(order).toMatchObject({ order: { status: chartStatus } })),
      );
    });
  });

  it.effect("reaches the aggregate's status for a cancelled order", () => {
    const o1 = orderRef(1);
    const history: ReadonlyArray<OrderFact> = [samPlaced, cancelled];
    return Effect.gen(function* () {
      const chart = yield* replay(o1.id, history);
      const chartStatus = Option.getOrNull(statusOfChart(chart));
      expect(chartStatus).toBe("cancelled");
      yield* story(
        given(o1, samPlaced),
        as(barista),
        when(o1, new CancelOrder()),
        then(o1, cancelled),
        when(o1, new StartBrewing()),
        rejected(new InvalidStatusTransition({ orderId: o1.id, from: "cancelled", to: "brewing" })),
        state(o1, (order) => expect(order).toMatchObject({ order: { status: chartStatus } })),
      );
      // The chart refuses the same move the aggregate refused.
      expect(yield* Effect.flip(decideWithChart(o1.id, chart, "brewing"))).toEqual(
        new InvalidStatusTransition({ orderId: o1.id, from: "cancelled", to: "brewing" }),
      );
    });
  });

  it.effect("replays deterministically and round-trips its snapshots", () =>
    Effect.gen(function* () {
      const o1 = orderRef(1);
      const chart = yield* replay(o1.id, historyTo("ready"));
      expect(yield* replay(o1.id, historyTo("ready"))).toEqual(chart);
      expect(
        yield* Machine.decodeSnapshot(OrderChart, yield* Machine.encodeSnapshot(OrderChart, chart)),
      ).toEqual(chart);

      // A completed chart decodes to the same active path but lists `completed`
      // in definition order, so compare the encoding instead of the snapshot.
      const done = yield* replay(o1.id, historyTo("picked-up"));
      const decoded = yield* Machine.decodeSnapshot(
        OrderChart,
        yield* Machine.encodeSnapshot(OrderChart, done),
      );
      expect(OrderStates.matches(decoded, "PickedUp")).toBe(true);
      expect(yield* Machine.encodeSnapshot(OrderChart, decoded)).toEqual(
        yield* Machine.encodeSnapshot(OrderChart, done),
      );
    }),
  );
});

describe("redelivery", () => {
  const samsCart = Cart.ref(sam.userId);
  const o9 = orderRef(9);
  const prepared = {
    checkoutId: checkoutId(1),
    items: [latte] as const,
    totalPrice: latte.lineTotal,
    createdAt: DateTime.makeUnsafe(placedAt),
    expiresAt: DateTime.makeUnsafe("2026-10-18T09:15:00.000Z"),
  };

  it.effect("confirms twice: one fulfillment, one order, and one chart replay", () =>
    Effect.gen(function* () {
      yield* story(
        given(samsCart, new CheckoutPrepared({ checkout: prepared })),
        clock(placedAt),
        as(sam),
        when(samsCart, new ConfirmCheckout({ checkoutId: checkoutId(1), orderId: o9.id })),
        then(o9, samPlaced),
        Story.saga(FulfillCheckout, o9.id, { _tag: "Completed", result: undefined }),
        when(
          samsCart,
          new AddCartItem({
            cartItemId: cartItem(2),
            item: { drinkId: "latte", size: "medium", milk: "oat" },
          }),
        ),
        when(samsCart, new PrepareCheckout({ checkoutId: checkoutId(2) })),
        when(samsCart, new ConfirmCheckout({ checkoutId: checkoutId(2), orderId: o9.id })),
        replied({ orderId: o9.id }),
        // The redelivered confirmation commits nothing: the stream keeps its one OrderPlaced.
        then(o9),
        Story.saga(FulfillCheckout, o9.id, { _tag: "Completed", result: undefined }),
        state(o9, (order) => expect(order).toMatchObject({ order: { status: "pending" } })),
      );
      expect(Option.getOrNull(statusOfChart(yield* replay(o9.id, [samPlaced])))).toBe("pending");
    }),
  );

  it.effect("refuses a duplicated fact the aggregate's idempotent command absorbs", () => {
    const o1 = orderRef(1);
    return Effect.gen(function* () {
      // `PlaceCheckedOutOrder` answers [] for a placed order, so the stream keeps
      // one OrderPlaced; the chart, reading the same fact twice, refuses it.
      expect(yield* Effect.flip(replay(o1.id, [samPlaced, samPlaced]))).toEqual(
        new InvalidStatusTransition({ orderId: o1.id, from: "pending", to: "pending" }),
      );
      expect(yield* Effect.flip(replay(o1.id, [samPlaced, brewed, brewed]))).toEqual(
        new InvalidStatusTransition({ orderId: o1.id, from: "brewing", to: "brewing" }),
      );
    });
  });
});
