import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import {
  CurrentActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  addCartItem,
  checkoutCart,
  clearCart,
  getCart,
  getItemOptions,
  quoteOrder,
  removeCartItem,
  updateCartItem,
  validateOrder,
} from "@effect-coffee-shop/coffee-core/application/use-cases/index";

const provideSystemActor = Effect.provideService(CurrentActor, systemActor);

describe("cart and order planning", () => {
  it.effect("quotes and validates multi-item orders with Money totals", () =>
    Effect.gen(function* () {
      const request = {
        items: [
          { drinkId: "latte", size: "medium", shots: 2, quantity: 2 },
          { drinkId: "tea", size: "small" },
        ],
      };

      const quote = yield* quoteOrder(request);
      const validation = yield* validateOrder(request);

      assert.strictEqual(quote.items.length, 2);
      assert.strictEqual(moneyToCents(quote.totalPrice), 1511);
      assert.deepStrictEqual(validation, quote);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("returns menu item options and defaults", () =>
    Effect.gen(function* () {
      const options = yield* getItemOptions({ drinkId: "cold-brew" });

      assert.strictEqual(options.item.name, "Cold Brew");
      assert.strictEqual(options.defaultTemperature, "iced");
      assert.strictEqual(options.defaultQuantity, 1);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("mutates and checks out the actor cart", () =>
    Effect.gen(function* () {
      const empty = yield* getCart();
      const added = yield* addCartItem({
        drinkId: "latte",
        size: "medium",
        milk: "oat",
        quantity: 2,
      });
      const cartItemId = added.items[0]?.cartItemId;

      assert.strictEqual(empty.items.length, 0);
      assert.ok(cartItemId !== undefined);
      assert.strictEqual(added.items.length, 1);

      const updated = yield* updateCartItem({
        cartItemId,
        shots: 2,
      });
      assert.strictEqual(updated.items[0]?.item.shots, 2);

      const order = yield* checkoutCart({});
      const afterCheckout = yield* getCart();

      assert.strictEqual(order.items.length, 1);
      assert.strictEqual(order.items[0]?.quantity, 2);
      assert.strictEqual(afterCheckout.items.length, 0);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("removes and clears cart items", () =>
    Effect.gen(function* () {
      const added = yield* addCartItem({ drinkId: "tea", size: "small" });
      const cartItemId = added.items[0]?.cartItemId;

      assert.ok(cartItemId !== undefined);

      const removed = yield* removeCartItem({ cartItemId });
      const cleared = yield* clearCart();

      assert.strictEqual(removed.items.length, 0);
      assert.strictEqual(cleared.items.length, 0);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );
});
