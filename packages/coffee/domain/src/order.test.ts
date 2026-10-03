import { assert, describe, it } from "@effect/vitest";
import { MachineTest } from "@typeonce/effect-machine/testing";
import * as Effect from "effect/Effect";
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import { orderStatuses, type OrderStatus } from "./order.ts";
import {
  canTransitionTo,
  FulfillmentEvents,
  orderFulfillment,
  transitionOrderStatus,
} from "./order-fulfillment.ts";

const allowedTransitions = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
} as const satisfies Record<OrderStatus, ReadonlyArray<OrderStatus>>;

describe("order domain", () => {
  it.effect.each(orderStatuses.flatMap((from) => orderStatuses.map((to) => ({ from, to }))))(
    "validates the transition from $from to $to",
    ({ from, to }) =>
      Effect.gen(function* () {
        const allowed = allowedTransitions[from].some((status) => status === to);
        const next = yield* transitionOrderStatus(from, to);
        assert.strictEqual(canTransitionTo(from, to), allowed);
        assert.deepStrictEqual(next, allowed ? Option.some(to) : Option.none());
      }),
  );

  it.effect("covers fulfillment and both cancellation paths with absorbing terminal states", () =>
    Effect.gen(function* () {
      const pickup = yield* MachineTest.run(orderFulfillment, {
        events: [
          FulfillmentEvents.MarkReady(),
          FulfillmentEvents.PickUp(),
          FulfillmentEvents.StartBrewing(),
          FulfillmentEvents.StartBrewing(),
          FulfillmentEvents.MarkReady(),
          FulfillmentEvents.Cancel(),
          FulfillmentEvents.PickUp(),
          FulfillmentEvents.Cancel(),
          FulfillmentEvents.PickUp(),
        ],
      });
      assert.deepStrictEqual(
        pickup.steps.map((step) => step.after.state.path),
        [
          "pending",
          "pending",
          "brewing",
          "brewing",
          "ready",
          "ready",
          "picked-up",
          "picked-up",
          "picked-up",
        ],
      );

      const cancelPending = yield* MachineTest.run(orderFulfillment, {
        events: [
          FulfillmentEvents.Cancel(),
          FulfillmentEvents.StartBrewing(),
          FulfillmentEvents.Cancel(),
        ],
      });
      const cancelBrewing = yield* MachineTest.run(orderFulfillment, {
        events: [
          FulfillmentEvents.StartBrewing(),
          FulfillmentEvents.Cancel(),
          FulfillmentEvents.MarkReady(),
        ],
      });
      assert.isTrue(cancelPending.steps.every((step) => step.after.state.path === "cancelled"));
      assert.deepStrictEqual(
        cancelBrewing.steps.map((step) => step.after.state.path),
        ["brewing", "cancelled", "cancelled"],
      );

      const traces = [pickup, cancelPending, cancelBrewing];
      yield* Effect.forEach(
        traces,
        (trace) =>
          Effect.gen(function* () {
            yield* MachineTest.verify(orderFulfillment, trace);
            assert.isTrue(
              trace.steps.every((step) => Arr.isReadonlyArrayEmpty(step.plan.commands)),
            );
          }),
        { concurrency: 1 },
      );
      const coverage = MachineTest.coverage(orderFulfillment, traces);
      assert.strictEqual(coverage.transitions.definitions.total, 5);
      assert.strictEqual(coverage.transitions.definitions.missing, 0);
    }),
  );
});
