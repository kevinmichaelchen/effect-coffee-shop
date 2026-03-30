import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { InMemoryCoffeeAppLive } from "../src/external/live.ts";
import {
  cancelOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "../src/service/use-cases/index.ts";

const withApp = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.provide(InMemoryCoffeeAppLive));

const baseOrderRequest = {
  customerName: "Avery",
  drinkId: "latte",
  size: "medium",
} as const;

describe("order service", () => {
  it.effect.each([
    {
      request: {
        ...baseOrderRequest,
      },
      expected: {
        customerName: "Avery",
        milk: "whole",
        temperature: "hot",
        shots: 1,
      },
    },
    {
      request: {
        customerName: "Morgan",
        drinkId: "cold-brew",
        size: "large",
      },
      expected: {
        customerName: "Morgan",
        milk: "whole",
        temperature: "iced",
        shots: 1,
      },
    },
    {
      request: {
        customerName: "Jordan",
        drinkId: "tea",
        size: "small",
      },
      expected: {
        customerName: "Jordan",
        milk: "none",
        temperature: "hot",
        shots: 0,
      },
    },
  ])("applies menu-driven defaults %#", ({ request, expected }) =>
    Effect.gen(function* () {
      const order = yield* withApp(placeOrder(request));

      assert.strictEqual(order.customerName, expected.customerName);
      assert.strictEqual(order.milk, expected.milk);
      assert.strictEqual(order.temperature, expected.temperature);
      assert.strictEqual(order.shots, expected.shots);
    }),
  );

  it.effect("trims customer names and drops blank notes", () =>
    Effect.gen(function* () {
      const order = yield* withApp(
        placeOrder({
          customerName: "  Avery  ",
          drinkId: "latte",
          size: "medium",
          notes: "   ",
        }),
      );

      assert.strictEqual(order.customerName, "Avery");
      assert.strictEqual(order.notes, undefined);
    }),
  );

  it.effect.each([
    {
      request: {
        ...baseOrderRequest,
        customerName: "   ",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "customerName must not be blank");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        drinkId: "mocha",
      },
      verify: (error: { _tag: string; drinkId?: string }) => {
        assert.strictEqual(error._tag, "DrinkNotFoundError");
        assert.strictEqual(error.drinkId, "mocha");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        size: "bucket",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "size must be one of: small, medium, large");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        milk: "soy",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "milk must be one of: whole, oat, almond, none");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        drinkId: "americano",
        milk: "oat",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, 'Americano does not support milk option "oat"');
      },
    },
    {
      request: {
        ...baseOrderRequest,
        temperature: "warm",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "temperature must be one of: hot, iced, extra-hot");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        drinkId: "cold-brew",
        temperature: "extra-hot",
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, 'Cold Brew does not support temperature "extra-hot"');
      },
    },
    {
      request: {
        ...baseOrderRequest,
        shots: -1,
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "shots must be a non-negative integer");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        shots: 1.5,
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "shots must be a non-negative integer");
      },
    },
    {
      request: {
        ...baseOrderRequest,
        shots: 5,
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "Latte supports at most 4 shot(s)");
      },
    },
    {
      request: {
        customerName: "Morgan",
        drinkId: "tea",
        size: "small",
        shots: 1,
      },
      verify: (error: { _tag: string; message?: string }) => {
        assert.strictEqual(error._tag, "InvalidOrderInputError");
        assert.strictEqual(error.message, "Tea drinks do not support extra shots");
      },
    },
  ])("rejects invalid order input %#", ({ request, verify }) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(withApp(placeOrder(request)));
      verify(error);
    }),
  );

  it.effect("rejects unsupported order status filters", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(withApp(listOrders({ status: "queued" })));

      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, 'status "queued" is not supported');
    }),
  );

  it.effect.each([
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        const updated = yield* startBrewing(created.id);
        assert.strictEqual(updated.status, "brewing");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        const updated = yield* cancelOrder(created.id);
        assert.strictEqual(updated.status, "cancelled");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        yield* startBrewing(created.id);
        const updated = yield* markReady(created.id);
        assert.strictEqual(updated.status, "ready");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        yield* startBrewing(created.id);
        const updated = yield* cancelOrder(created.id);
        assert.strictEqual(updated.status, "cancelled");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        yield* startBrewing(created.id);
        yield* markReady(created.id);
        const updated = yield* pickUpOrder(created.id);
        assert.strictEqual(updated.status, "picked-up");
      }),
    },
  ])("allows valid status transitions %#", ({ program }) => withApp(program));

  it.effect.each([
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        const error = yield* Effect.flip(markReady(created.id));
        if (error._tag !== "InvalidOrderStatusTransitionError") {
          assert.fail(`Expected InvalidOrderStatusTransitionError, received ${error._tag}`);
        }

        assert.strictEqual(error.from, "pending");
        assert.strictEqual(error.to, "ready");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        const error = yield* Effect.flip(pickUpOrder(created.id));
        if (error._tag !== "InvalidOrderStatusTransitionError") {
          assert.fail(`Expected InvalidOrderStatusTransitionError, received ${error._tag}`);
        }

        assert.strictEqual(error.from, "pending");
        assert.strictEqual(error.to, "picked-up");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        yield* startBrewing(created.id);
        yield* markReady(created.id);
        const error = yield* Effect.flip(startBrewing(created.id));
        if (error._tag !== "InvalidOrderStatusTransitionError") {
          assert.fail(`Expected InvalidOrderStatusTransitionError, received ${error._tag}`);
        }

        assert.strictEqual(error.from, "ready");
        assert.strictEqual(error.to, "brewing");
      }),
    },
    {
      program: Effect.gen(function* () {
        const created = yield* placeOrder(baseOrderRequest);
        yield* startBrewing(created.id);
        yield* markReady(created.id);
        const error = yield* Effect.flip(cancelOrder(created.id));
        if (error._tag !== "InvalidOrderStatusTransitionError") {
          assert.fail(`Expected InvalidOrderStatusTransitionError, received ${error._tag}`);
        }

        assert.strictEqual(error.from, "ready");
        assert.strictEqual(error.to, "cancelled");
      }),
    },
    {
      program: Effect.gen(function* () {
        const error = yield* Effect.flip(startBrewing("order-9999"));
        assert.strictEqual(error._tag, "OrderNotFoundError");
        assert.strictEqual(error.orderId, "order-9999");
      }),
    },
  ])("rejects invalid status transitions %#", ({ program }) => withApp(program));
});
