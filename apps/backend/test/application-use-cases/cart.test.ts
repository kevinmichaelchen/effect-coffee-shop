import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import {
  CurrentActor,
  type AppActor,
  systemActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { checkoutSessionIdFromString } from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import { QuoteOrderRequestSchema } from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  addCartItem,
  checkoutCart,
  clearCart,
  getCart,
  getCurrentCheckoutSession,
  getItemOptions,
  listOrders,
  prepareCartCheckout,
  quoteOrder,
  removeCartItem,
  updateCartItem,
  validateOrder,
} from "@effect-coffee-shop/coffee-core/application/use-cases/index";

const provideSystemActor = Effect.provideService(CurrentActor, systemActor);
const decodeQuoteOrderRequest = Schema.decodeUnknownSync(QuoteOrderRequestSchema);
const averyActor: AppActor = {
  displayName: "Avery",
  kind: "customer",
  userId: "user-avery",
};
const blakeActor: AppActor = {
  displayName: "Blake",
  kind: "customer",
  userId: "user-blake",
};
const provideActor =
  (actor: AppActor) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(Effect.provideService(CurrentActor, actor));

describe("cart and order planning", () => {
  it.effect("quotes and validates multi-item orders with Money totals", () =>
    Effect.gen(function* () {
      const request = decodeQuoteOrderRequest({
        items: [
          { drinkId: "latte", size: "medium", shots: 2, quantity: 2 },
          { drinkId: "tea", size: "small" },
        ],
      });

      const quote = yield* quoteOrder(request);
      const validation = yield* validateOrder(request);

      assert.strictEqual(quote.items.length, 2);
      assert.strictEqual(moneyToCents(quote.totalPrice), 1511);
      assert.deepStrictEqual(validation, quote);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("quotes do not persist orders", () =>
    Effect.gen(function* () {
      const quote = yield* quoteOrder({
        items: [{ drinkId: "latte", size: "medium", quantity: 2 }],
      });
      const orders = yield* listOrders({});

      assert.strictEqual(quote.items.length, 1);
      assert.strictEqual(moneyToCents(quote.totalPrice), 1036);
      assert.strictEqual(orders.length, 0);
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

      const session = yield* prepareCartCheckout();
      const order = yield* checkoutCart({ checkoutSessionId: session.id });
      const afterCheckout = yield* getCart();
      const afterCheckoutSession = yield* getCurrentCheckoutSession();

      assert.strictEqual(order.items.length, 1);
      assert.strictEqual(order.items[0]?.quantity, 2);
      assert.strictEqual(afterCheckout.items.length, 0);
      assert.deepStrictEqual(afterCheckoutSession, Option.none());
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("prepares a checkout session from the current cart without placing an order", () =>
    Effect.gen(function* () {
      yield* addCartItem({
        drinkId: "latte",
        size: "medium",
        milk: "oat",
        shots: 2,
        quantity: 2,
      });

      const session = yield* prepareCartCheckout();
      const currentSession = yield* getCurrentCheckoutSession();
      const cart = yield* getCart();
      const orders = yield* listOrders({});

      assert.strictEqual(session.id, "checkout-session-0001");
      assert.strictEqual(session.status, "awaiting_confirmation");
      assert.strictEqual(session.ownerUserId, "system");
      assert.strictEqual(session.items.length, 1);
      assert.strictEqual(session.items[0]?.drinkName, "Latte");
      assert.strictEqual(session.items[0]?.quantity, 2);
      assert.strictEqual(moneyToCents(session.totalPrice), 1186);
      assert.deepStrictEqual(currentSession, Option.some(session));
      assert.strictEqual(cart.items.length, 1);
      assert.strictEqual(orders.length, 0);
    }).pipe(provideSystemActor, Effect.provide(InMemoryCoffeeAppLive)),
  );

  it.effect("requires the checkout session id when checking out the cart", () =>
    Effect.gen(function* () {
      yield* addCartItem({ drinkId: "latte", size: "medium" });

      const exit = yield* checkoutCart({
        checkoutSessionId: checkoutSessionIdFromString("checkout-session-9999"),
      }).pipe(Effect.exit);

      assert.isTrue(exit._tag === "Failure");
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

  it.effect("scopes carts to the signed-in actor", () =>
    Effect.gen(function* () {
      const averyCart = yield* addCartItem({ drinkId: "latte", size: "medium" }).pipe(
        provideActor(averyActor),
      );
      const blakeEmptyCart = yield* getCart().pipe(provideActor(blakeActor));
      const blakeCart = yield* addCartItem({ drinkId: "tea", size: "small" }).pipe(
        provideActor(blakeActor),
      );
      const averySession = yield* prepareCartCheckout().pipe(provideActor(averyActor));
      const averyOrder = yield* checkoutCart({ checkoutSessionId: averySession.id }).pipe(
        provideActor(averyActor),
      );
      const averyAfterCheckout = yield* getCart().pipe(provideActor(averyActor));
      const blakeAfterAveryCheckout = yield* getCart().pipe(provideActor(blakeActor));

      assert.strictEqual(averyCart.ownerUserId, "user-avery");
      assert.strictEqual(averyCart.items.length, 1);
      assert.strictEqual(blakeEmptyCart.ownerUserId, "user-blake");
      assert.strictEqual(blakeEmptyCart.items.length, 0);
      assert.strictEqual(blakeCart.items.length, 1);
      assert.strictEqual(averyOrder.ownerUserId, "user-avery");
      assert.strictEqual(averyAfterCheckout.items.length, 0);
      assert.strictEqual(blakeAfterAveryCheckout.items.length, 1);
      assert.strictEqual(blakeAfterAveryCheckout.items[0]?.item.drinkId, "tea");
    }).pipe(Effect.provide(InMemoryCoffeeAppLive)),
  );
});
