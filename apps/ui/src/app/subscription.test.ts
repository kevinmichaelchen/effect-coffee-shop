import { CoffeeShop, CoffeeShopHandlers } from "@effect-coffee-shop/coffee-domain/CoffeeShop.model";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { CurrentActor } from "@effect-coffee-shop/coffee-domain/CurrentActor.context";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { makeOrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { Session, Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Domain from "@alchemy.run/domain";
import { Array, DateTime, Option, Schema } from "effect";
import type { Duration } from "effect";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as References from "effect/References";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import * as AsyncData from "foldkit/asyncData";
import { Http } from "foldkit";
import { expect, test } from "vitest";
import type { Actor } from "@effect-coffee-shop/coffee-domain/Actor";
import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee-schemas.ts";
import type { Feed } from "#app/feed.ts";
import { init } from "#app/main.ts";
import { managedResources } from "#app/resources.ts";
import { OrdersData, ViewerData, ordersOf } from "#app/model.ts";
import { subscriptions } from "#app/subscription.ts";
import { update } from "#app/update.ts";
import { Message } from "../message.ts";

/** Runs a test on the test clock: every retry wait is virtual, so it never waits. */
const run = async <E>(program: Effect.Effect<void, E>) => {
  await Effect.runPromise(program.pipe(Effect.provide(TestClock.layer())));
};

/** The in-memory platform logs view backfill progress at Info; a stray line can race teardown. */
const QuietLogs = Layer.succeed(References.MinimumLogLevel, "Warn");

const sam: Actor = {
  kind: "customer",
  userId: CustomerId.make("user-sam"),
  displayName: "Sam",
};
const bo: Actor = { kind: "customer", userId: CustomerId.make("user-bo"), displayName: "Bo" };

/** The Worker's session middleware, with the caller already resolved. */
const sessionAs = (actor: Actor) =>
  Layer.succeed(Session, (effect) => Effect.provideService(effect, CurrentActor, actor));

const modelWorld = CoffeeShop.layer(CoffeeShopHandlers).pipe(
  Layer.provide(Domain.InMemory),
  Layer.provide(QuietLogs),
);

/**
 * The handles the runtime holds while a resource is idle. Every Foldkit
 * Subscription carries the app's services, but the orders watch reads none of
 * them; the keys are the runtime's own resource tags, which are typed `any`.
 */
const idleResourceHandles = Layer.mergeAll(
  Layer.succeed(managedResources.assistantWorker.resource._tag, Ref.makeUnsafe(Option.none())),
  Layer.succeed(managedResources.microphone.resource._tag, Ref.makeUnsafe(Option.none())),
);

type WatchOrders = Effect.Success<typeof CustomerApi.client>["CustomerOrders"]["watch"];

/** Serves a scripted watch in place of the in-process client's, for drops a live feed cannot cause. */
const scriptedCustomer = (watch: WatchOrders) =>
  Layer.effect(
    CustomerApi.Client,
    Effect.map(CustomerApi.Client, (client) => ({
      ...client,
      CustomerOrders: { ...client.CustomerOrders, watch },
    })),
  );

/**
 * A model world whose session is one account. The Apis run in process, so a
 * watch is delivered from the same memory the commands write: no sockets, no
 * Worker and no timers. A scripted watch replaces the customer's when given.
 */
const world = (actor: Actor, watch?: WatchOrders) =>
  Layer.merge(
    Layer.merge(
      watch === undefined
        ? CustomerApi.layerClientInProcess
        : scriptedCustomer(watch).pipe(Layer.provide(CustomerApi.layerClientInProcess)),
      StaffApi.layerClientInProcess,
    ),
    Layer.merge(Http.layer, idleResourceHandles),
  ).pipe(Layer.provide(Layer.merge(sessionAs(actor), modelWorld)));

const samsFeed: Feed = { _tag: "CustomerOrders", customerId: sam.userId };
const samsConnection = { userId: sam.userId, feed: samsFeed };

/** The live order watch, as the app's Foldkit Subscription builds it for one connection. */
const orders = (connection: typeof samsConnection) =>
  subscriptions.orders.dependenciesToStream({ connection: Option.some(connection) });

const orderAt = "2026-10-27T12:00:00.000Z";

/** An order in the domain's own shape, as the view folds it. */
const domainOrder = (id: string): CoffeeOrder =>
  Schema.decodeSync(CoffeeOrder)({
    id,
    customerName: "Sam",
    ownerUserId: sam.userId,
    items: [
      {
        drinkId: "latte",
        drinkName: "Latte",
        size: "medium",
        milk: "oat",
        temperature: "hot",
        shots: 1,
        quantity: 1,
        unitPrice: { currency: "USD", minorUnits: 518 },
        lineTotal: { currency: "USD", minorUnits: 518 },
      },
    ],
    status: "pending",
    totalPrice: { currency: "USD", minorUnits: 518 },
    createdAt: DateTime.makeUnsafe(orderAt),
  });

const firstOrder = domainOrder(`order_${"0".repeat(25)}1`);
const secondOrder = domainOrder(`order_${"0".repeat(25)}2`);

/** The snapshot a `CustomerOrders` watch pushes: the view's state, and its cursor. */
const snapshot = (orders: ReadonlyArray<CoffeeOrder>, cursor: number) => ({
  state: orders.length === 0 ? null : { orders },
  cursor,
});

type WatchSnapshot = Stream.Success<ReturnType<WatchOrders>>;

/**
 * A customer watch that follows the script, remembering each key it was asked
 * for and which attempt it is on, so a test can assert the reconnection.
 */
const scripted = (script: (attempt: number) => Stream.Stream<WatchSnapshot, Unauthorized>) => {
  const keys: Array<string> = [];
  let attempt = 0;
  const watch: WatchOrders = (key) => {
    keys.push(key);
    attempt += 1;
    return script(attempt);
  };
  return { watch, keys };
};

/** Everything a stream emits until the test interrupts it, with the test clock's time. */
const record = <R>(stream: Stream.Stream<Message, never, R>) =>
  Effect.gen(function* () {
    const seen = yield* Ref.make<ReadonlyArray<{ readonly at: number; readonly message: Message }>>(
      [],
    );
    const fiber = yield* stream.pipe(
      Stream.runForEach((message) =>
        Effect.flatMap(
          TestClock.testClockWith((clock) => Effect.sync(() => clock.currentTimeMillisUnsafe())),
          (at) => Ref.update(seen, (all) => [...all, { at, message }]),
        ),
      ),
      Effect.forkChild,
    );
    return { seen, fiber };
  });

/** Let queued in-memory work run, and its messages land. */
const settle = Effect.yieldNow;

/** The page load's command-id session, so a test knows the ids the app will send. */
const flags = { theme: "light", commandIds: { session: "test", sent: 0 } } as const;

const url = (pathname: string) => ({
  protocol: "https:",
  host: "coffee.test",
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
});

/** The app's Model on the shop page, signed in as `actor`, with `orders` already loaded. */
const signedIn = (actor: Actor, orders: ReadonlyArray<OrderTicket>) => ({
  ...init(flags, url("/shop")).model,
  viewer: ViewerData.Success({
    data: { kind: "customer", displayName: actor.displayName, userId: actor.userId },
  }),
  orders: OrdersData.Success({ data: orders }),
});

/** The item at `index`, or a failure the test cannot continue past. */
const nth = <A>(items: ReadonlyArray<A>, index: number): A =>
  Option.getOrThrow(Option.fromNullishOr(items[index]));

/** The ticket ids a loaded-feed message carries. */
const ticketIds = (message: Message) =>
  message._tag === "LoadedOrders" ? message.orders.map((order) => order.id) : [];

test("a live watch pushes the customer's orders as the model commits them", async () => {
  await run(
    Effect.gen(function* () {
      const { seen, fiber } = yield* record(orders(samsConnection).pipe(Stream.take(2)));
      const customers = yield* CustomerApi.Client;
      yield* settle;
      const orderId = yield* makeOrderId;
      yield* customers.PlaceOrder(orderId, {
        items: [{ drinkId: "latte", size: "medium", milk: "oat" }],
      });
      // The view folds the commit on its own queued work; the second push waits for it.
      yield* Fiber.join(fiber);

      const messages = yield* Ref.get(seen);
      expect(messages.map(({ message }) => message._tag)).toEqual(["LoadedOrders", "LoadedOrders"]);
      expect(ticketIds(nth(messages, 1).message)).toEqual([orderId]);
    }).pipe(Effect.provide(world(sam))),
  );
});

test("a dropped feed reconnects with a capped, doubling pause", async () => {
  const script = scripted(() => Stream.fail(new Unauthorized()));
  await run(
    Effect.gen(function* () {
      const { seen, fiber } = yield* record(orders(samsConnection).pipe(Stream.take(7)));
      yield* settle;

      const lastAt = Effect.map(Ref.get(seen), (messages) =>
        Array.last(messages).pipe(Option.match({ onNone: () => 0, onSome: ({ at }) => at })),
      );
      const timesAfter = (pause: Duration.Input) =>
        Effect.gen(function* () {
          yield* TestClock.adjust(pause);
          yield* settle;
          return yield* lastAt;
        });

      const times: Array<number> = [];
      for (const pause of [
        "250 millis",
        "500 millis",
        "1 second",
        "2 seconds",
        "4 seconds",
      ] as const) {
        times.push(yield* timesAfter(pause));
      }
      // 250 ms, then doubling; the wait is capped at 5 s, not 8 s.
      expect(times).toEqual([250, 750, 1750, 3750, 7750]);
      yield* TestClock.adjust("4999 millis");
      yield* settle;
      expect((yield* Ref.get(seen)).length).toBe(6);
      expect(yield* timesAfter("1 millis")).toBe(12_750);
      yield* Fiber.interrupt(fiber);

      const messages = yield* Ref.get(seen);
      expect(messages.map(({ message }) => message._tag)).toEqual(
        messages.map(() => "FailedOrders"),
      );
      expect(
        messages.map(({ message }) => (message._tag === "FailedOrders" ? message.userId : "")),
      ).toEqual(messages.map(() => sam.userId));
      expect(script.keys).toEqual(messages.map(() => sam.userId));
    }).pipe(Effect.provide(world(sam, script.watch))),
  );
});

test("a reconnect delivers the view's current state after the drop", async () => {
  const script = scripted((attempt) =>
    attempt === 1
      ? Stream.concat(Stream.make(snapshot([], 1)), Stream.fail(new Unauthorized()))
      : Stream.make(snapshot([firstOrder, secondOrder], 2)).pipe(Stream.concat(Stream.never)),
  );
  await run(
    Effect.gen(function* () {
      const { seen, fiber } = yield* record(orders(samsConnection).pipe(Stream.take(3)));
      yield* settle;
      yield* TestClock.adjust("250 millis");
      yield* Fiber.join(fiber);

      const messages = yield* Ref.get(seen);
      // The empty first read, the disconnect, then the state as it stands now.
      expect(messages.map(({ message }) => message._tag)).toEqual([
        "LoadedOrders",
        "FailedOrders",
        "LoadedOrders",
      ]);
      expect(ticketIds(nth(messages, 2).message)).toEqual([firstOrder.id, secondOrder.id]);
      expect(script.keys).toEqual([sam.userId, sam.userId]);
    }).pipe(Effect.provide(world(sam, script.watch))),
  );
});

test("the previous account's snapshot never reaches the screen after a switch", async () => {
  const script = scripted(() =>
    Stream.make(snapshot([firstOrder], 1)).pipe(Stream.concat(Stream.never)),
  );
  await run(
    Effect.gen(function* () {
      const { seen, fiber } = yield* record(orders(samsConnection).pipe(Stream.take(1)));
      yield* Fiber.join(fiber);
      const previous = nth(yield* Ref.get(seen), 0).message;
      expect(ticketIds(previous)).toEqual([firstOrder.id]);

      // The page now shows Bo's feed: Sam's ticket can still arrive on the old watch.
      const page = signedIn(bo, []);
      const unchanged = update(page, previous);
      expect(unchanged.model.orders).toEqual(page.orders);

      // Bo's own snapshot is the one that fills the list.
      const boFeed: Feed = { _tag: "CustomerOrders", customerId: bo.userId };
      const theirs = update(
        page,
        Message.LoadedOrders({ feed: boFeed, userId: bo.userId, orders: [] }),
      );
      expect(ordersOf(theirs.model)).toEqual([]);
      expect(script.keys).toEqual([sam.userId]);
    }).pipe(Effect.provide(world(sam, script.watch))),
  );
});

test("a dropped feed keeps the last snapshot as Stale until the next one arrives", async () => {
  const script = scripted((attempt) =>
    attempt === 1
      ? Stream.concat(Stream.make(snapshot([firstOrder], 1)), Stream.fail(new Unauthorized()))
      : Stream.make(snapshot([firstOrder, secondOrder], 2)).pipe(Stream.concat(Stream.never)),
  );
  await run(
    Effect.gen(function* () {
      const { seen, fiber } = yield* record(orders(samsConnection).pipe(Stream.take(3)));
      yield* settle;
      yield* TestClock.adjust("250 millis");
      yield* Fiber.join(fiber);

      const messages = (yield* Ref.get(seen)).map(({ message }) => message);
      const [loaded, dropped, refreshed] = [nth(messages, 0), nth(messages, 1), nth(messages, 2)];
      const loadedPage = update(signedIn(sam, []), loaded);
      expect(ticketIds(loaded)).toEqual([firstOrder.id]);
      expect(AsyncData.isSuccess(loadedPage.model.orders)).toBe(true);

      // The drop leaves the snapshot on screen, marked Stale rather than empty.
      const stalePage = update(loadedPage.model, dropped);
      expect(AsyncData.isStale(stalePage.model.orders)).toBe(true);
      expect(ordersOf(stalePage.model).map((order) => order.id)).toEqual([firstOrder.id]);
      expect(Option.isSome(AsyncData.getError(stalePage.model.orders))).toBe(true);

      // The reconnected snapshot replaces it.
      const refreshedPage = update(stalePage.model, refreshed);
      expect(AsyncData.isSuccess(refreshedPage.model.orders)).toBe(true);
      expect(ordersOf(refreshedPage.model).map((order) => order.id)).toEqual([
        firstOrder.id,
        secondOrder.id,
      ]);
    }).pipe(Effect.provide(world(sam, script.watch))),
  );
});
