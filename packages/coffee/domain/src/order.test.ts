import { assert, describe, it } from "@effect/vitest";
import { canTransitionTo, orderStatuses, type OrderStatus } from "./order.ts";

const allowedTransitions = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
} as const satisfies Record<OrderStatus, ReadonlyArray<OrderStatus>>;

describe("order domain", () => {
  it.each(orderStatuses.flatMap((from) => orderStatuses.map((to) => ({ from, to }))))(
    "validates the transition from $from to $to",
    ({ from, to }) => {
      assert.strictEqual(
        canTransitionTo(from, to),
        allowedTransitions[from].some((status) => status === to),
      );
    },
  );
});
