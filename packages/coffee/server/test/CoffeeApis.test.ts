import { describe, expect, it } from "@effect/vitest";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-application/CoffeeOrderApp";
import { CurrentActor as AppActor } from "@effect-coffee-shop/coffee-application/CurrentActor";
import type { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.aggregate";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Headers from "effect/http/Headers";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as Schema from "effect/Schema";
import { actorHeader, SessionLive, withActorHeader } from "../src/Session.ts";
import { Actor as ActorSchema } from "@effect-coffee-shop/coffee-domain/Actor";

const World = Layer.mergeAll(SessionLive, CoffeeOrderApp.layer).pipe(
  Layer.provideMerge(CoffeeShop.layer(CoffeeShopHandlers)),
  Layer.provide(Domain.InMemory),
);

const person = (kind: Actor["kind"], userId: string, displayName: string): Actor => ({
  kind,
  userId: CustomerId.make(userId),
  displayName,
});
const sam = person("customer", "user-sam", "Sam");
const alex = person("customer", "user-alex", "Alex");
const barista = person("staff", "user-bo", "Bo");

const encodeActor = Schema.encodeSync(Schema.fromJsonString(ActorSchema));
/** Views are eventually consistent: read until the expected state arrives. */
const eventually = <A, E, R>(read: Effect.Effect<A, E, R>, ready: (value: A) => boolean) =>
  read.pipe(
    Effect.repeat({ until: ready, schedule: Schedule.spaced("20 millis") }),
    Effect.timeout("3 seconds"),
  );

/** What the Worker attaches after authenticating the caller's session. */
const as = (actor: Actor) => ({ headers: { [actorHeader]: encodeActor(actor) } });

describe("the domain Apis over the in-memory platform", () => {
  it.live("a customer orders, staff brew it, and both read the ticket", () =>
    Effect.gen(function* () {
      const customers = yield* CustomerApi.testClient;
      const staff = yield* StaffApi.testClient;
      const orderId = yield* makeOrderId;

      const placed = yield* customers.PlaceOrder(
        { target: orderId, items: [{ drinkId: "latte", size: "medium", milk: "oat" }] },
        as(sam),
      );
      expect(placed.reply.order.customerName).toBe("Sam");
      expect(placed.reply.order.totalPrice.minorUnits).toBe(518);

      // CustomerOrders folds OrderSummary, a step behind the order itself.
      const mine = yield* eventually(customers.CustomerOrders.get(sam.userId, as(sam)), (view) =>
        Boolean(view?.orders.length),
      );
      expect(mine?.orders.map((order) => order.id)).toEqual([orderId]);

      const brewing = yield* staff.StartBrewing({ target: orderId }, as(barista));
      expect(brewing.reply.order.status).toBe("brewing");

      const queue = yield* eventually(staff.OrderQueue.get(mainShop, as(barista)), (view) =>
        Boolean(view?.orders.some((order) => order.status === "brewing")),
      );
      expect(queue?.orders.map((order) => [order.id, order.status])).toEqual([
        [orderId, "brewing"],
      ]);
    }).pipe(Effect.scoped, Effect.provide(World)),
  );

  it.live("authorizes every entry: sessions, staff-only commands, and owners' reads", () =>
    Effect.gen(function* () {
      const customers = yield* CustomerApi.testClient;
      const staff = yield* StaffApi.testClient;
      const orderId = yield* makeOrderId;

      const signedOut = yield* customers
        .PlaceOrder({ target: orderId, items: [{ drinkId: "tea", size: "small" }] })
        .pipe(Effect.flip);
      expect(signedOut._tag).toBe("Unauthorized");

      const placed = yield* customers.PlaceOrder(
        { target: orderId, items: [{ drinkId: "tea", size: "small" }] },
        as(sam),
      );

      const notStaff = yield* staff.StartBrewing({ target: orderId }, as(sam)).pipe(Effect.flip);
      expect(notStaff._tag).toBe("StaffOnly");

      const queue = yield* staff.OrderQueue.get(mainShop, as(alex)).pipe(Effect.flip);
      expect(queue._tag).toBe("StaffOnly");

      const someoneElses = yield* customers.OrderSummary.get(orderId, {
        ...as(alex),
        atLeast: { stream: placed.stream, version: placed.version },
      }).pipe(Effect.flip);
      expect(someoneElses._tag).toBe("NotYourOrder");

      const othersCart = yield* customers.Cart.get(sam.userId, as(alex)).pipe(Effect.flip);
      expect(othersCart._tag).toBe("NotYourCart");
    }).pipe(Effect.scoped, Effect.provide(World)),
  );
});

describe("the application service over the model", () => {
  it.live("checks a cart out into one order, placed by the domain's policy", () =>
    Effect.gen(function* () {
      const app = yield* CoffeeOrderApp;
      yield* app.addCartItem({ drinkId: "latte", size: "large" });
      const cart = yield* app.addCartItem({ drinkId: "espresso", size: "small", quantity: 2 });
      expect(cart.items).toHaveLength(2);

      const session = yield* app.prepareCartCheckout();
      expect(session.totalPrice).toEqual(cart.totalPrice);

      const order = yield* app.checkoutCart({ checkoutSessionId: session.id });
      expect(order.items.map((item) => item.drinkId)).toEqual(["latte", "espresso"]);
      expect(order.ownerUserId).toBe(sam.userId);

      const emptied = yield* app.getCart();
      expect(emptied.items).toEqual([]);
      expect(Option.isNone(yield* app.getCurrentCheckoutSession())).toBe(true);

      const again = yield* app.checkoutCart({ checkoutSessionId: session.id }).pipe(Effect.flip);
      expect(again._tag).toBe("InvalidOrderInputError");
    }).pipe(Effect.provideService(AppActor, sam), Effect.provide(World)),
  );

  it.live("translates rejections into the adapters' errors", () =>
    Effect.gen(function* () {
      const app = yield* CoffeeOrderApp;
      const missing = yield* app
        .placeOrder({ items: [{ drinkId: "mocha", size: "small" }] })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({ _tag: "DrinkNotFoundError", drinkId: "mocha" });

      const order = yield* app.placeOrder({ items: [{ drinkId: "tea", size: "small" }] });
      const notStaff = yield* app.startBrewing(order.id).pipe(Effect.flip);
      expect(notStaff._tag).toBe("StaffRoleRequiredError");

      const skipped = yield* app
        .markReady(order.id)
        .pipe(Effect.provideService(AppActor, barista), Effect.flip);
      expect(skipped).toMatchObject({
        _tag: "InvalidOrderStatusTransitionError",
        from: "pending",
        to: "ready",
      });
    }).pipe(Effect.provideService(AppActor, sam), Effect.provide(World)),
  );
});

describe("the session header", () => {
  it("is set only by the Worker: a client's copy is replaced or removed", () => {
    const forged = HttpServerRequest.fromWeb(
      new Request("https://coffee.example/api/customer", {
        headers: { [actorHeader]: encodeActor(barista) },
      }),
    );
    const header = (actor: Parameters<typeof withActorHeader>[1]) =>
      Option.getOrUndefined(Headers.get(withActorHeader(forged, actor).headers, actorHeader));
    expect(header(sam)).toBe(encodeActor(sam));
    expect(header({ kind: "anonymous" })).toBeUndefined();
  });
});
