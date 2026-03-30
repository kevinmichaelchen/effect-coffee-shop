import { describe, expect, test } from "bun:test"
import * as Effect from "effect/Effect"
import { InMemoryCoffeeAppLive } from "../src/external/live.ts"
import {
  getOrder,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing
} from "../src/service/use-cases/index.ts"

describe("coffee order workflow", () => {
  test("runs a full happy-path lifecycle in memory", async () => {
    const program = Effect.gen(function*() {
      const created = yield* placeOrder({
        customerName: "Avery",
        drinkId: "latte",
        size: "large",
        milk: "oat",
        temperature: "extra-hot",
        shots: 2
      })
      const loaded = yield* getOrder(created.id)
      const brewing = yield* startBrewing(created.id)
      const ready = yield* markReady(created.id)
      const pickedUp = yield* pickUpOrder(created.id)
      const pickedUpOrders = yield* listOrders({ status: "picked-up" })

      return {
        created,
        loaded,
        brewing,
        ready,
        pickedUp,
        pickedUpOrders
      }
    }).pipe(Effect.provide(InMemoryCoffeeAppLive))

    const result = await Effect.runPromise(program)

    expect(result.created.status).toBe("pending")
    expect(result.loaded.id).toBe(result.created.id)
    expect(result.brewing.status).toBe("brewing")
    expect(result.ready.status).toBe("ready")
    expect(result.pickedUp.status).toBe("picked-up")
    expect(result.pickedUpOrders).toHaveLength(1)
    expect(result.pickedUpOrders[0]?.id).toBe(result.created.id)
  })

  test("rejects tea shots that violate the domain rules", async () => {
    const program = placeOrder({
      customerName: "Morgan",
      drinkId: "tea",
      size: "small",
      shots: 1
    }).pipe(Effect.provide(InMemoryCoffeeAppLive))

    await expect(Effect.runPromise(program)).rejects.toThrow("Tea drinks do not support extra shots")
  })
})
