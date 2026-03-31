import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { InMemoryCoffeeAppLive } from "#external/live";
import {
  getOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "#service/use-cases/index";

describe("coffee order workflow", () => {
  it.effect("runs a full happy-path lifecycle in memory", () =>
    Effect.gen(function* () {
      const result = yield* Effect.gen(function* () {
        const created = yield* placeOrder({
          customerName: "Avery",
          drinkId: "latte",
          size: "large",
          milk: "oat",
          temperature: "extra-hot",
          shots: 2,
        });
        const loaded = yield* getOrder(created.id);
        const brewing = yield* startBrewing(created.id);
        const ready = yield* markReady(created.id);
        const pickedUp = yield* pickUpOrder(created.id);
        const pickedUpOrders = yield* listOrders({ status: "picked-up" });

        return {
          created,
          loaded,
          brewing,
          ready,
          pickedUp,
          pickedUpOrders,
        };
      }).pipe(Effect.provide(InMemoryCoffeeAppLive));

      assert.strictEqual(result.created.status, "pending");
      assert.isTrue(DateTime.isUtc(result.created.createdAt));
      assert.strictEqual(result.loaded.id, result.created.id);
      assert.strictEqual(result.brewing.status, "brewing");
      assert.strictEqual(result.ready.status, "ready");
      assert.strictEqual(result.pickedUp.status, "picked-up");
      assert.strictEqual(result.pickedUpOrders.length, 1);
      assert.strictEqual(result.pickedUpOrders[0]?.id, result.created.id);
    }),
  );

  it.effect("rejects tea shots that violate the domain rules", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        placeOrder({
          customerName: "Morgan",
          drinkId: "tea",
          size: "small",
          shots: 1,
        }).pipe(Effect.provide(InMemoryCoffeeAppLive)),
      );

      assert.strictEqual(error.message, "Tea drinks do not support extra shots");
    }),
  );

  it.effect("generates human-readable ids while keeping createdAt serializable", () =>
    Effect.gen(function* () {
      const result = yield* Effect.gen(function* () {
        const first = yield* placeOrder({
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        });
        const second = yield* placeOrder({
          customerName: "Morgan",
          drinkId: "tea",
          size: "small",
        });

        return {
          first,
          second,
          encodedFirst: JSON.parse(JSON.stringify(first)),
        };
      }).pipe(Effect.provide(InMemoryCoffeeAppLive));

      assert.strictEqual(result.first.id, "order-0001");
      assert.strictEqual(result.second.id, "order-0002");
      assert.isTrue(DateTime.isUtc(result.first.createdAt));
      assert.match(result.encodedFirst.createdAt, /^\d{4}-\d{2}-\d{2}T/);
    }),
  );
});
