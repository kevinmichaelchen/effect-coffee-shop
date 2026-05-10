import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  cancelOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "@effect-coffee-shop/coffee-core/application/use-cases/index";

const baseOrderRequest = {
  customerName: "Avery",
  items: [
    {
      drinkId: "latte",
      size: "medium",
    },
  ],
} as const;

const validTransitionPrograms = [
  Effect.gen(function* () {
    const created = yield* placeOrder(baseOrderRequest);
    const updated = yield* startBrewing(created.id);
    assert.strictEqual(updated.status, "brewing");
  }),
  Effect.gen(function* () {
    const created = yield* placeOrder(baseOrderRequest);
    const updated = yield* cancelOrder(created.id);
    assert.strictEqual(updated.status, "cancelled");
  }),
  Effect.gen(function* () {
    const created = yield* placeOrder(baseOrderRequest);
    yield* startBrewing(created.id);
    const updated = yield* markReady(created.id);
    assert.strictEqual(updated.status, "ready");
  }),
  Effect.gen(function* () {
    const created = yield* placeOrder(baseOrderRequest);
    yield* startBrewing(created.id);
    const updated = yield* cancelOrder(created.id);
    assert.strictEqual(updated.status, "cancelled");
  }),
  Effect.gen(function* () {
    const created = yield* placeOrder(baseOrderRequest);
    yield* startBrewing(created.id);
    yield* markReady(created.id);
    const updated = yield* pickUpOrder(created.id);
    assert.strictEqual(updated.status, "picked-up");
  }),
];

const provideSystemActor = Effect.provideService(CurrentActor, systemActor);

describe("order status", () => {
  it.effect("rejects unsupported order status filters", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(listOrders({ status: "queued" }));

      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, 'status "queued" is not supported');
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect.each(validTransitionPrograms)("allows valid status transitions %#", (program) =>
    program.pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );
});
