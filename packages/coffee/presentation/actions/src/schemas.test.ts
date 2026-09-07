import { assert, describe, expect, it } from "@effect/vitest";
import * as Exit from "effect/Exit";
import * as Effect from "effect/Effect";
import { decodePlaceOrderInput, decodeQuoteOrderInput } from "./schemas.ts";

describe("coffee action schemas", () => {
  it.effect("trims order boundary strings before application use cases run", () =>
    Effect.gen(function* () {
      const input = yield* decodePlaceOrderInput({
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
      });

      assert.strictEqual(input.customerName, "Avery");
      assert.strictEqual(input.items[0].drinkId, "latte");
      assert.strictEqual(input.items[0].milk, "oat");
      assert.strictEqual(input.items[0].notes, "extra hot");
      assert.strictEqual(input.items[0].size, "medium");
      assert.strictEqual(input.items[0].temperature, "hot");
    }),
  );

  it.effect("rejects old single-drink order payloads", () =>
    Effect.gen(function* () {
      const result = yield* decodePlaceOrderInput({
        customerName: "Avery",
        drinkId: "latte",
        size: "medium",
      }).pipe(Effect.exit);
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );

  it.effect("rejects empty quote item lists at the boundary", () =>
    Effect.gen(function* () {
      const result = yield* decodeQuoteOrderInput({ items: [] }).pipe(Effect.exit);
      expect(Exit.isFailure(result)).toBe(true);
    }),
  );
});
