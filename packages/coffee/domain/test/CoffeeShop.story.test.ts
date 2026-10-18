import { assert, describe, expect, it } from "@effect/vitest";
import { Story } from "alchemy/Domain/Story";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { type Actor, systemActor } from "../src/Actor.ts";
import { AddCartItem, CartItemAdded } from "../src/Cart/AddCartItem.command.ts";
import { Cart } from "../src/Cart/Cart.aggregate.ts";
import { CartItemId } from "../src/Cart/CartItem.id.ts";
import { CartItemNotFound } from "../src/Cart/CartItemNotFound.rejection.ts";
import { CheckoutId } from "../src/Cart/Checkout.ts";
import { CartCleared, ClearCart } from "../src/Cart/ClearCart.command.ts";
import {
  CheckoutConfirmed,
  CheckoutExpired,
  CheckoutNotFound,
  ConfirmCheckout,
} from "../src/Cart/ConfirmCheckout.command.ts";
import { NotYourCart } from "../src/Cart/NotYourCart.rejection.ts";
import { CheckoutPrepared, PrepareCheckout } from "../src/Cart/PrepareCheckout.command.ts";
import { CartItemRemoved, RemoveCartItem } from "../src/Cart/RemoveCartItem.command.ts";
import { CartItemUpdated, UpdateCartItem } from "../src/Cart/UpdateCartItem.command.ts";
import { CoffeeShop, CoffeeShopHandlers } from "../src/CoffeeShop.model.ts";
import { CurrentActor } from "../src/CurrentActor.context.ts";
import { Customer } from "../src/Customer/Customer.aggregate.ts";
import { CustomerId } from "../src/Customer/Customer.id.ts";
import { DrinkNotFound } from "../src/Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../src/Menu/InvalidOrder.rejection.ts";
import { type CoffeeOrderItem, priceOrderItem } from "../src/Menu/OrderItem.ts";
import { CustomerName } from "../src/Menu/OrderPrimitives.ts";
import { moneyFromCents } from "../src/Money.ts";
import { BrewingStarted, StartBrewing } from "../src/Order/StartBrewing.command.ts";
import { CancelOrder, OrderCancelled } from "../src/Order/CancelOrder.command.ts";
import { CustomerOrders } from "../src/Order/CustomerOrders.view.ts";
import { InvalidStatusTransition } from "../src/Order/InvalidStatusTransition.rejection.ts";
import { MarkReady, OrderReady } from "../src/Order/MarkReady.command.ts";
import { Order } from "../src/Order/Order.aggregate.ts";
import { OrderId } from "../src/Order/Order.id.ts";
import { OrderNotFound } from "../src/Order/OrderNotFound.rejection.ts";
import { OrderQueue } from "../src/Order/OrderQueue.view.ts";
import { OrderSummary } from "../src/Order/OrderSummary.view.ts";
import { OrderPickedUp, PickUpOrder } from "../src/Order/PickUpOrder.command.ts";
import { AlreadyPlaced, OrderPlaced, PlaceOrder } from "../src/Order/PlaceOrder.command.ts";
import { mainShop, Shop } from "../src/Shop/Shop.aggregate.ts";
import { StaffOnly } from "../src/StaffOnly.rejection.ts";

const { clock, given, provide, rejected, replied, state, then, view, when } = Story;

const story = Story.make(CoffeeShop, { layer: CoffeeShopHandlers });

/** Act as this actor for the following commands, as their session middleware would. */
const as = (actor: Actor) => provide(CurrentActor, actor);

const person = (kind: Actor["kind"], userId: string, displayName: string): Actor => ({
  kind,
  userId: CustomerId.make(userId),
  displayName,
});
const sam = person("customer", "user-sam", "Sam");
const alex = person("customer", "user-alex", "Alex");
const barista = person("staff", "user-bo", "Bo");

const id = (prefix: string, n: number) => `${prefix}_${"0".repeat(25)}${n}`;
const orderRef = (n: number) => Order.ref(OrderId.make(id("order", n)));
const cartItem = (n: number) => CartItemId.make(id("cart_item", n));
const checkoutId = (n: number) => CheckoutId.make(id("checkout_session", n));

const priced = (request: Parameters<typeof priceOrderItem>[0]): CoffeeOrderItem =>
  Result.match(priceOrderItem(request), {
    onSuccess: (item) => item,
    onFailure: (failure) => assert.fail(`fixture does not price: ${failure._tag}`),
  });

const latte = priced({ drinkId: "latte", size: "medium", milk: "oat" });
const twoEspressos = priced({ drinkId: "espresso", size: "small", quantity: 2 });
const placedAt = "2026-10-18T09:00:00.000Z";

const samPlaced = new OrderPlaced({
  customerId: sam.userId,
  customerName: CustomerName.make("Sam"),
  items: [latte],
  totalPrice: latte.lineTotal,
});

describe("placing orders", () => {
  it.effect("prices the drinks and puts the ticket in the customer's list and the queue", () => {
    const o1 = orderRef(1);
    return story(
      clock(placedAt),
      as(sam),
      when(o1, new PlaceOrder({ items: [{ drinkId: "latte", size: "medium", milk: "oat" }] })),
      then(o1, samPlaced),
      replied({
        order: {
          id: o1.id,
          customerName: "Sam",
          ownerUserId: sam.userId,
          items: [latte],
          status: "pending",
          totalPrice: moneyFromCents(518),
          createdAt: DateTime.makeUnsafe(placedAt),
        },
      }),
      view(OrderSummary, o1, (summary) => expect(summary.order?.status).toBe("pending")),
      view(CustomerOrders, Customer.ref(sam.userId), (orders) =>
        expect(orders.orders.map((order) => order.id)).toEqual([o1.id]),
      ),
      view(OrderQueue, Shop.ref(mainShop), (queue) =>
        expect(queue.orders.map((order) => order.customerName)).toEqual(["Sam"]),
      ),
    );
  });

  it.effect("refuses drinks the menu does not offer, and impossible choices", () =>
    story(
      as(sam),
      when(orderRef(1), new PlaceOrder({ items: [{ drinkId: "mocha", size: "medium" }] })),
      rejected(new DrinkNotFound({ drinkId: "mocha" })),
      when(orderRef(1), new PlaceOrder({ items: [{ drinkId: "tea", size: "large", shots: 2 }] })),
      rejected(new InvalidOrder({ message: "Tea drinks do not support extra shots" })),
      when(orderRef(1), new PlaceOrder({ items: [] })),
      rejected(new InvalidOrder({ message: "items must include at least one drink" })),
      then(orderRef(1)),
    ),
  );

  it.effect("places a ticket once", () =>
    story(
      given(orderRef(1), samPlaced),
      as(alex),
      when(orderRef(1), new PlaceOrder({ items: [{ drinkId: "tea", size: "small" }] })),
      rejected(new AlreadyPlaced({ orderId: orderRef(1).id })),
    ),
  );

  it.effect("lets the system name the customer, but not leave it blank", () =>
    story(
      as(systemActor),
      when(
        orderRef(1),
        new PlaceOrder({ customerName: "", items: [{ drinkId: "tea", size: "small" }] }),
      ),
      rejected(new InvalidOrder({ message: "customerName must not be blank" })),
      when(
        orderRef(1),
        new PlaceOrder({ customerName: "Walk-in", items: [{ drinkId: "tea", size: "small" }] }),
      ),
      state(orderRef(1), (order) =>
        expect(order).toMatchObject({ order: { customerName: "Walk-in" } }),
      ),
    ),
  );

  it.effect("keeps each customer's orders apart, and lets only staff read the queue", () =>
    story(
      as(sam),
      when(orderRef(1), new PlaceOrder({ items: [{ drinkId: "latte", size: "medium" }] })),
      as(alex),
      when(orderRef(2), new PlaceOrder({ items: [{ drinkId: "tea", size: "small" }] })),
      view(CustomerOrders, Customer.ref(sam.userId), (orders) =>
        expect(orders.orders.map((order) => order.customerName)).toEqual(["Sam"]),
      ),
      view(CustomerOrders, Customer.ref(alex.userId), (orders) =>
        expect(orders.orders.map((order) => order.customerName)).toEqual(["Alex"]),
      ),
      view(OrderQueue, Shop.ref(mainShop), (queue) => expect(queue.orders).toHaveLength(2)),
    ),
  );
});

describe("fulfilling orders", () => {
  it.effect("moves a ticket through brewing, ready and picked up", () => {
    const o1 = orderRef(1);
    return story(
      given(o1, samPlaced),
      as(barista),
      when(o1, new StartBrewing()),
      when(o1, new MarkReady()),
      when(o1, new PickUpOrder()),
      then(
        o1,
        new BrewingStarted({ by: barista }),
        new OrderReady({ by: barista }),
        new OrderPickedUp({ by: barista }),
      ),
      view(OrderSummary, o1, (summary) => expect(summary.order?.status).toBe("picked-up")),
      view(CustomerOrders, Customer.ref(sam.userId), (orders) =>
        expect(orders.orders.map((order) => order.status)).toEqual(["picked-up"]),
      ),
    );
  });

  it.effect("refuses skipped, repeated and backward steps", () => {
    const o1 = orderRef(1);
    return story(
      given(o1, samPlaced),
      as(barista),
      when(o1, new MarkReady()),
      rejected(new InvalidStatusTransition({ orderId: o1.id, from: "pending", to: "ready" })),
      when(o1, new StartBrewing()),
      when(o1, new StartBrewing()),
      rejected(new InvalidStatusTransition({ orderId: o1.id, from: "brewing", to: "brewing" })),
      when(o1, new MarkReady()),
      when(o1, new CancelOrder()),
      rejected(new InvalidStatusTransition({ orderId: o1.id, from: "ready", to: "cancelled" })),
    );
  });

  it.effect("cancels a pending order, and nothing moves it afterwards", () => {
    const o1 = orderRef(1);
    return story(
      given(o1, samPlaced),
      as(barista),
      when(o1, new CancelOrder()),
      then(o1, new OrderCancelled({ by: barista })),
      when(o1, new StartBrewing()),
      rejected(new InvalidStatusTransition({ orderId: o1.id, from: "cancelled", to: "brewing" })),
    );
  });

  it.effect("only staff move tickets, and only tickets that exist", () =>
    story(
      given(orderRef(1), samPlaced),
      as(sam),
      when(orderRef(1), new StartBrewing()),
      rejected(new StaffOnly()),
      as(barista),
      when(orderRef(2), new StartBrewing()),
      rejected(new OrderNotFound({ orderId: orderRef(2).id })),
    ),
  );
});

describe("the cart", () => {
  const samsCart = Cart.ref(sam.userId);

  it.effect("adds, changes and removes priced lines", () =>
    story(
      as(sam),
      when(
        samsCart,
        new AddCartItem({ cartItemId: cartItem(1), item: { drinkId: "latte", size: "medium" } }),
      ),
      when(
        samsCart,
        new AddCartItem({ cartItemId: cartItem(2), item: { drinkId: "espresso", size: "small" } }),
      ),
      when(samsCart, new UpdateCartItem({ cartItemId: cartItem(2), changes: { quantity: 2 } })),
      replied({
        cart: {
          items: [
            { cartItemId: cartItem(1), item: priced({ drinkId: "latte", size: "medium" }) },
            { cartItemId: cartItem(2), item: twoEspressos },
          ],
          totalPrice: moneyFromCents(518 + 600),
          checkout: null,
        },
      }),
      when(samsCart, new RemoveCartItem({ cartItemId: cartItem(1) })),
      then(
        samsCart,
        new CartItemAdded({
          cartItemId: cartItem(1),
          item: priced({ drinkId: "latte", size: "medium" }),
        }),
        new CartItemAdded({
          cartItemId: cartItem(2),
          item: priced({ drinkId: "espresso", size: "small" }),
        }),
        new CartItemUpdated({ cartItemId: cartItem(2), item: twoEspressos }),
        new CartItemRemoved({ cartItemId: cartItem(1) }),
      ),
      when(samsCart, new RemoveCartItem({ cartItemId: cartItem(1) })),
      rejected(new CartItemNotFound({ cartItemId: cartItem(1) })),
      when(samsCart, new ClearCart()),
      then(samsCart, new CartCleared()),
      when(samsCart, new ClearCart()),
      then(samsCart),
    ),
  );

  it.effect("adding the same line twice changes nothing", () =>
    story(
      given(samsCart, new CartItemAdded({ cartItemId: cartItem(1), item: latte })),
      as(sam),
      when(
        samsCart,
        new AddCartItem({ cartItemId: cartItem(1), item: { drinkId: "tea", size: "small" } }),
      ),
      then(samsCart),
    ),
  );

  it.effect("belongs to its owner alone", () =>
    story(
      as(alex),
      when(
        samsCart,
        new AddCartItem({ cartItemId: cartItem(1), item: { drinkId: "latte", size: "medium" } }),
      ),
      rejected(new NotYourCart()),
    ),
  );
});

describe("checkout", () => {
  const samsCart = Cart.ref(sam.userId);
  const o9 = orderRef(9);
  const prepared = {
    checkoutId: checkoutId(1),
    items: [latte] as const,
    totalPrice: latte.lineTotal,
    createdAt: DateTime.makeUnsafe(placedAt),
    expiresAt: DateTime.makeUnsafe("2026-10-18T09:15:00.000Z"),
  };

  it.effect("freezes the cart's prices, then places the order and empties the cart", () =>
    story(
      given(samsCart, new CartItemAdded({ cartItemId: cartItem(1), item: latte })),
      clock(placedAt),
      as(sam),
      when(samsCart, new PrepareCheckout({ checkoutId: checkoutId(1) })),
      then(samsCart, new CheckoutPrepared({ checkout: prepared })),
      replied({ checkout: prepared }),
      clock("2026-10-18T09:10:00.000Z"),
      when(samsCart, new ConfirmCheckout({ checkoutId: checkoutId(1), orderId: o9.id })),
      replied({ orderId: o9.id }),
      then(
        samsCart,
        new CheckoutConfirmed({
          orderId: o9.id,
          customerName: CustomerName.make("Sam"),
          checkout: prepared,
        }),
      ),
      then(o9, samPlaced),
      state(samsCart, (cart) => expect(cart).toEqual({ lines: [], checkout: null })),
      view(CustomerOrders, Customer.ref(sam.userId), (orders) =>
        expect(orders.orders.map((order) => order.id)).toEqual([o9.id]),
      ),
    ),
  );

  it.effect("needs something in the cart", () =>
    story(
      as(sam),
      when(samsCart, new PrepareCheckout({ checkoutId: checkoutId(1) })),
      rejected(new InvalidOrder({ message: "cart must include at least one item" })),
    ),
  );

  it.effect("refuses an unknown or expired checkout", () =>
    story(
      given(
        samsCart,
        new CartItemAdded({ cartItemId: cartItem(1), item: latte }),
        new CheckoutPrepared({ checkout: prepared }),
      ),
      as(sam),
      clock("2026-10-18T09:05:00.000Z"),
      when(samsCart, new ConfirmCheckout({ checkoutId: checkoutId(2), orderId: o9.id })),
      rejected(new CheckoutNotFound({ checkoutId: checkoutId(2) })),
      clock("2026-10-18T09:16:00.000Z"),
      when(samsCart, new ConfirmCheckout({ checkoutId: checkoutId(1), orderId: o9.id })),
      rejected(new CheckoutExpired({ checkoutId: checkoutId(1), expiredAt: prepared.expiresAt })),
      then(o9),
      state(samsCart, (cart) => expect(Option.fromNullishOr(cart.checkout)._tag).toBe("Some")),
    ),
  );
});
