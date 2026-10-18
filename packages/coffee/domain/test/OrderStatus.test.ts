import { assert, describe, it } from "@effect/vitest";
import { canTransitionTo, type OrderStatus, orderStatuses } from "../src/Order/OrderStatus.ts";

const allowedTransitions = {
  pending: ["brewing", "cancelled"],
  brewing: ["ready", "cancelled"],
  ready: ["picked-up"],
  "picked-up": [],
  cancelled: [],
} as const satisfies Record<OrderStatus, ReadonlyArray<OrderStatus>>;

describe("order lifecycle", () => {
  it.each(orderStatuses.flatMap((from) => orderStatuses.map((to) => ({ from, to }))))(
    "allows $from -> $to only along the lifecycle",
    ({ from, to }) => {
      const allowed = allowedTransitions[from].some((status) => status === to);
      assert.strictEqual(canTransitionTo(from, to), allowed);
    },
  );
});
