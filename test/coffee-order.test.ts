import { describe, expect, test } from "bun:test";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { InMemoryCoffeeAppLive } from "../src/external/live.ts";
import {
  getOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "../src/service/use-cases/index.ts";

describe("coffee order workflow", () => {
  test("runs a full happy-path lifecycle in memory", async () => {
    const program = Effect.gen(function* () {
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

    const result = await Effect.runPromise(program);

    expect(result.created.status).toBe("pending");
    expect(DateTime.isUtc(result.created.createdAt)).toBe(true);
    expect(result.loaded.id).toBe(result.created.id);
    expect(result.brewing.status).toBe("brewing");
    expect(result.ready.status).toBe("ready");
    expect(result.pickedUp.status).toBe("picked-up");
    expect(result.pickedUpOrders).toHaveLength(1);
    expect(result.pickedUpOrders[0]?.id).toBe(result.created.id);
  });

  test("rejects tea shots that violate the domain rules", async () => {
    const program = placeOrder({
      customerName: "Morgan",
      drinkId: "tea",
      size: "small",
      shots: 1,
    }).pipe(Effect.provide(InMemoryCoffeeAppLive));

    const error = await Effect.runPromise(Effect.flip(program));

    expect(error.message).toBe("Tea drinks do not support extra shots");
  });

  test("generates human-readable ids while keeping createdAt serializable", async () => {
    const program = Effect.gen(function* () {
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

    const result = await Effect.runPromise(program);

    expect(result.first.id).toBe("order-0001");
    expect(result.second.id).toBe("order-0002");
    expect(DateTime.isUtc(result.first.createdAt)).toBe(true);
    expect(result.encodedFirst.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
