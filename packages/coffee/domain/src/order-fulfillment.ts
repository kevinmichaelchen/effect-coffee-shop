/**
 * Plans the staff-controlled fulfillment lifecycle from a persisted order status.
 *
 * @module
 */
import { Machine } from "@typeonce/effect-machine";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import type { OrderStatus } from "./order.ts";

const Root = Machine.state({
  states: {
    pending: {},
    brewing: {},
    ready: {},
    "picked-up": {},
    cancelled: {},
  },
});

export const FulfillmentEvents = Machine.events({
  StartBrewing: {},
  MarkReady: {},
  PickUp: {},
  Cancel: {},
});

export const orderFulfillment = Machine.make({ root: Root, events: FulfillmentEvents }).handle({
  initial: { target: "pending" },
  states: {
    pending: {
      on: {
        StartBrewing: { target: "brewing" },
        Cancel: { target: "cancelled" },
      },
    },
    brewing: {
      on: {
        MarkReady: { target: "ready" },
        Cancel: { target: "cancelled" },
      },
    },
    ready: { on: { PickUp: { target: "picked-up" } } },
    "picked-up": {},
    cancelled: {},
  },
});

// The repository has already decoded this status. No machine data or running work
// needs restoration: this model owns only the status and has no commands/invokes.
const snapshotFromStatus = (status: OrderStatus): Machine.Snapshot<typeof orderFulfillment> => ({
  path: "",
  value: undefined,
  state: { path: status, value: undefined },
});

const eventForStatus = (status: OrderStatus) =>
  Match.value(status).pipe(
    Match.when("pending", () => Option.none<Machine.EventOf<typeof FulfillmentEvents>>()),
    Match.when("brewing", () => Option.some(FulfillmentEvents.StartBrewing())),
    Match.when("ready", () => Option.some(FulfillmentEvents.MarkReady())),
    Match.when("picked-up", () => Option.some(FulfillmentEvents.PickUp())),
    Match.when("cancelled", () => Option.some(FulfillmentEvents.Cancel())),
    Match.exhaustive,
  );

export const canTransitionTo = (from: OrderStatus, to: OrderStatus): boolean =>
  Option.match(eventForStatus(to), {
    onNone: () => false,
    onSome: (event) =>
      Machine.enabled(orderFulfillment, snapshotFromStatus(from)).includes(event._tag),
  });

/** Accept only a changed plan that settles on the requested target. */
export const transitionOrderStatus = Effect.fn("OrderFulfillment.transitionOrderStatus")(function* (
  from: OrderStatus,
  to: OrderStatus,
) {
  const next = yield* Option.match(eventForStatus(to), {
    onNone: () => Effect.succeed(Option.none<OrderStatus>()),
    onSome: (event) =>
      Machine.plan(orderFulfillment, snapshotFromStatus(from), event).pipe(
        Effect.map((plan) => Option.some(plan.next.state.path)),
      ),
  });
  return Option.filter(next, (status) => status !== from && status === to);
});
