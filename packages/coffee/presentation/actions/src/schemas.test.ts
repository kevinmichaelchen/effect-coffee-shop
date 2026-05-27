import { assert, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import { decodePlaceOrderInput, decodeQuoteOrderInput } from "./schemas.ts";

describe("coffee action schemas", () => {
  it("trims order boundary strings before application use cases run", async () => {
    const input = await Effect.runPromise(
      decodePlaceOrderInput({
        customerName: "  Avery  ",
        items: [
          {
            drinkId: " latte ",
            milk: " oat ",
            notes: "  extra hot  ",
            quantity: 2,
            size: " medium ",
            temperature: " hot ",
          },
        ],
      }),
    );

    assert.strictEqual(input.customerName, "Avery");
    assert.strictEqual(input.items[0].drinkId, "latte");
    assert.strictEqual(input.items[0].milk, "oat");
    assert.strictEqual(input.items[0].notes, "extra hot");
    assert.strictEqual(input.items[0].size, "medium");
    assert.strictEqual(input.items[0].temperature, "hot");
  });

  it("rejects old single-drink order payloads", async () => {
    await expect(
      Effect.runPromise(
        decodePlaceOrderInput({
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        }),
      ),
    ).rejects.toThrow();
  });

  it("rejects empty quote item lists at the boundary", async () => {
    await expect(Effect.runPromise(decodeQuoteOrderInput({ items: [] }))).rejects.toThrow();
  });
});
