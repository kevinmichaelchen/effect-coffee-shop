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
  it("accepts only the supported status transitions", () => {
    for (const from of orderStatuses) {
      for (const to of orderStatuses) {
        const nextStatuses = allowedTransitions[from];
        assert.strictEqual(
          canTransitionTo(from, to),
          nextStatuses.some((nextStatus) => nextStatus === to),
        );
      }
    }
  });
});
