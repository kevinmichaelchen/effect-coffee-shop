import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import type { PlaceOrderRequest } from "@effect-coffee-shop/coffee-core/application/contracts";
import { placeOrder } from "@effect-coffee-shop/coffee-core/application/use-cases/index";

const baseOrderRequest = {
  customerName: "Avery",
  items: [
    {
      drinkId: "latte",
      size: "medium",
    },
  ],
} as const;

type OrderError = {
  readonly _tag: string;
  readonly drinkId?: string;
  readonly message?: string;
};

const defaultCases = [
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
      items: [
        {
          drinkId: "cold-brew",
          size: "large",
        },
      ],
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
      items: [
        {
          drinkId: "tea",
          size: "small",
        },
      ],
    },
    expected: {
      customerName: "Jordan",
      milk: "none",
      temperature: "hot",
      shots: 0,
    },
  },
] as const;

const invalidInputCases: ReadonlyArray<{
  readonly request: PlaceOrderRequest;
  readonly verify: (error: OrderError) => void;
}> = [
  {
    request: {
      ...baseOrderRequest,
      customerName: "   ",
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "customerName must not be blank");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "mocha", size: "medium" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "DrinkNotFoundError");
      assert.strictEqual(error.drinkId, "mocha");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "bucket" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "size must be one of: small, medium, large");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "medium", milk: "soy" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "milk must be one of: whole, oat, almond, none");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "americano", size: "medium", milk: "oat" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, 'Americano does not support milk option "oat"');
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "medium", temperature: "warm" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "temperature must be one of: hot, iced, extra-hot");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "cold-brew", size: "medium", temperature: "extra-hot" }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, 'Cold Brew does not support temperature "extra-hot"');
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "medium", shots: -1 }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "shots must be a non-negative integer");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "medium", shots: 1.5 }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "shots must be a non-negative integer");
    },
  },
  {
    request: {
      ...baseOrderRequest,
      items: [{ drinkId: "latte", size: "medium", shots: 5 }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "Latte supports at most 4 shot(s)");
    },
  },
  {
    request: {
      customerName: "Morgan",
      items: [{ drinkId: "tea", size: "small", shots: 1 }],
    },
    verify: (error) => {
      assert.strictEqual(error._tag, "InvalidOrderInputError");
      assert.strictEqual(error.message, "Tea drinks do not support extra shots");
    },
  },
];

const provideSystemActor = Effect.provideService(CurrentActor, systemActor);

describe("place order", () => {
  it.effect.each(defaultCases)("applies menu-driven defaults %#", ({ request, expected }) =>
    Effect.gen(function* () {
      const order = yield* placeOrder(request);
      const item = order.items[0];

      assert.strictEqual(order.customerName, expected.customerName);
      assert.ok(item !== undefined);
      assert.strictEqual(item.milk, expected.milk);
      assert.strictEqual(item.temperature, expected.temperature);
      assert.strictEqual(item.shots, expected.shots);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("trims customer names and drops blank notes", () =>
    Effect.gen(function* () {
      const order = yield* placeOrder({
        customerName: "  Avery  ",
        items: [{ drinkId: "latte", size: "medium", notes: "   " }],
      });
      const item = order.items[0];

      assert.strictEqual(order.customerName, "Avery");
      assert.ok(item !== undefined);
      assert.strictEqual(item.notes, undefined);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect.each(invalidInputCases)("rejects invalid order input %#", ({ request, verify }) =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(placeOrder(request));
      verify(error);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );
});
