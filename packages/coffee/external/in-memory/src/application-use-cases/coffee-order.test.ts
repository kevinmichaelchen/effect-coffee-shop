import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "../index.ts";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  getOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "@effect-coffee-shop/coffee-core/application/use-cases/index";

const provideSystemActor = Effect.provideService(CurrentActor, systemActor);
const orderIdPattern = /^order_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;

describe("coffee order workflow", () => {
  it.effect("runs a full happy-path lifecycle in memory", () =>
    Effect.gen(function* () {
      const created = yield* placeOrder({
        customerName: "Avery",
        items: [
          {
            drinkId: "latte",
            size: "large",
            milk: "oat",
            temperature: "extra-hot",
            shots: 2,
          },
        ],
      });
      const loaded = yield* getOrder(created.id);
      const brewing = yield* startBrewing(created.id);
      const ready = yield* markReady(created.id);
      const pickedUp = yield* pickUpOrder(created.id);
      const pickedUpOrders = yield* listOrders({ status: "picked-up" });

      assert.strictEqual(created.status, "pending");
      assert.isTrue(DateTime.isUtc(created.createdAt));
      assert.strictEqual(loaded.id, created.id);
      assert.strictEqual(brewing.status, "brewing");
      assert.strictEqual(ready.status, "ready");
      assert.strictEqual(pickedUp.status, "picked-up");
      assert.strictEqual(pickedUpOrders.length, 1);
      assert.strictEqual(pickedUpOrders[0]?.id, created.id);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("rejects tea shots that violate the domain rules", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        placeOrder({
          customerName: "Morgan",
          items: [{ drinkId: "tea", size: "small", shots: 1 }],
        }),
      );

      assert.strictEqual(error.message, "Tea drinks do not support extra shots");
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("generates TypeIDs while keeping createdAt serializable", () =>
    Effect.gen(function* () {
      const first = yield* placeOrder({
        customerName: "Avery",
        items: [{ drinkId: "latte", size: "medium" }],
      });
      const second = yield* placeOrder({
        customerName: "Morgan",
        items: [{ drinkId: "tea", size: "small" }],
      });
      const encodedFirst = yield* Schema.encodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(
        first,
      );

      assert.match(first.id, orderIdPattern);
      assert.match(second.id, orderIdPattern);
      assert.notStrictEqual(first.id, second.id);
      assert.isTrue(DateTime.isUtc(first.createdAt));
      assert.match(encodedFirst, /"createdAt":"\d{4}-\d{2}-\d{2}T/);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );
});
