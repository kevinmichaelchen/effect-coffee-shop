import { assert, describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import {
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-domain/errors";
import { moneyFromCents } from "@effect-coffee-shop/coffee-domain/money";
import {
  CoffeeOrder,
  orderStatuses,
  type OrderStatus,
} from "@effect-coffee-shop/coffee-domain/order";
import { CurrentActor, anonymousActor, systemActor, type AppActor } from "../CurrentActor.ts";
import { InternalAppError, PersistenceError } from "../errors.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { cancelOrder, markReady, pickUpOrder, startBrewing } from "./changeOrderStatus.ts";

const order = Schema.decodeSync(CoffeeOrder)({
  id: "order_00000000000000000000000001",
  customerName: "Avery",
  ownerUserId: "user-avery",
  items: [
    {
      drinkId: "latte",
      drinkName: "Latte",
      size: "medium",
      milk: "whole",
      temperature: "hot",
      shots: 1,
      quantity: 1,
      notes: "no foam",
      unitPrice: moneyFromCents(500),
      lineTotal: moneyFromCents(500),
    },
  ],
  status: "pending",
  totalPrice: moneyFromCents(500),
  createdAt: DateTime.makeUnsafe("2026-01-01T10:00:00.000Z"),
});

const makeRepository = Effect.fn("OrderRepository.Test.make")(function* (
  initial: Option.Option<CoffeeOrder>,
) {
  const stored = yield* Ref.make(initial);
  const saved = yield* Ref.make<ReadonlyArray<CoffeeOrder>>([]);
  const reads = yield* Ref.make(0);
  const repository = OrderRepository.of({
    getById: Effect.fn("OrderRepository.Test.getById")(function* () {
      yield* Ref.update(reads, (count) => count + 1);
      return yield* Ref.get(stored);
    }),
    save: Effect.fn("OrderRepository.Test.save")(function* (updated) {
      yield* Ref.update(saved, (orders) => [...orders, updated]);
      yield* Ref.set(stored, Option.some(updated));
      return updated;
    }),
    list: Effect.fn("OrderRepository.Test.list")(function* () {
      return Option.toArray(yield* Ref.get(stored));
    }),
  });
  return { repository, stored, saved, reads };
});

const commands = [
  { to: "brewing", run: startBrewing, allowedFrom: ["pending"] },
  { to: "ready", run: markReady, allowedFrom: ["brewing"] },
  { to: "picked-up", run: pickUpOrder, allowedFrom: ["ready"] },
  { to: "cancelled", run: cancelOrder, allowedFrom: ["pending", "brewing"] },
] satisfies ReadonlyArray<{
  readonly to: OrderStatus;
  readonly run: typeof startBrewing;
  readonly allowedFrom: ReadonlyArray<OrderStatus>;
}>;

describe("staff order fulfillment", () => {
  it.effect.each(
    orderStatuses.flatMap((from) => commands.map((command) => ({ from, ...command }))),
  )("handles $from to $to without changing other order data", ({ from, to, run, allowedFrom }) =>
    Effect.gen(function* () {
      const initial = { ...order, status: from };
      const test = yield* makeRepository(Option.some(initial));
      const result = yield* run(order.id).pipe(
        Effect.provideService(CurrentActor, systemActor),
        Effect.provideService(OrderRepository, test.repository),
        Effect.result,
      );
      if (allowedFrom.some((status) => status === from)) {
        const updated = { ...initial, status: to };
        assert.deepStrictEqual(result, Result.succeed(updated));
        assert.deepStrictEqual(yield* Ref.get(test.saved), [updated]);
        assert.deepStrictEqual(yield* Ref.get(test.stored), Option.some(updated));
      } else {
        assert.deepStrictEqual(
          result,
          Result.fail(new InvalidOrderStatusTransitionError({ orderId: order.id, from, to })),
        );
        assert.deepStrictEqual(yield* Ref.get(test.saved), []);
        assert.deepStrictEqual(yield* Ref.get(test.stored), Option.some(initial));
      }
    }),
  );

  it.effect("reads the saved status for each command in a complete fulfillment", () =>
    Effect.gen(function* () {
      const test = yield* makeRepository(Option.some(order));
      yield* Effect.forEach(
        [startBrewing, markReady, pickUpOrder],
        (run) =>
          run(order.id).pipe(
            Effect.provideService(CurrentActor, {
              kind: "staff",
              displayName: "Barista",
              userId: "staff-barista",
            }),
            Effect.provideService(OrderRepository, test.repository),
          ),
        { concurrency: 1 },
      );
      assert.deepStrictEqual(
        (yield* Ref.get(test.saved)).map((saved) => saved.status),
        ["brewing", "ready", "picked-up"],
      );
      assert.deepStrictEqual(
        yield* Ref.get(test.stored),
        Option.some({ ...order, status: "picked-up" }),
      );
    }),
  );

  it.effect.each([
    { actor: anonymousActor, errorTag: "AuthenticationRequiredError" },
    {
      actor: { kind: "customer", displayName: "Avery", userId: "user-avery" },
      errorTag: "StaffRoleRequiredError",
    },
  ] satisfies ReadonlyArray<{ readonly actor: AppActor; readonly errorTag: string }>)(
    "rejects $actor.kind before accessing persistence",
    ({ actor, errorTag }) =>
      Effect.gen(function* () {
        const test = yield* makeRepository(Option.some(order));
        const error = yield* startBrewing(order.id).pipe(
          Effect.provideService(CurrentActor, actor),
          Effect.provideService(OrderRepository, test.repository),
          Effect.flip,
        );
        assert.strictEqual(error._tag, errorTag);
        assert.strictEqual(yield* Ref.get(test.reads), 0);
        assert.deepStrictEqual(yield* Ref.get(test.saved), []);
      }),
  );

  it.effect("reports missing orders without saving", () =>
    Effect.gen(function* () {
      const test = yield* makeRepository(Option.none());
      const error = yield* startBrewing(order.id).pipe(
        Effect.provideService(CurrentActor, systemActor),
        Effect.provideService(OrderRepository, test.repository),
        Effect.flip,
      );
      assert.deepStrictEqual(error, new OrderNotFoundError({ orderId: order.id }));
      assert.deepStrictEqual(yield* Ref.get(test.saved), []);
    }),
  );

  it.effect.each(["getById", "save"] as const)(
    "preserves the typed error and stored order when $0 fails",
    (operation) =>
      Effect.gen(function* () {
        const test = yield* makeRepository(Option.some(order));
        const cause = new PersistenceError({ message: "database unavailable" });
        const repository = OrderRepository.of({
          ...test.repository,
          [operation]: () => Effect.fail(cause),
        });
        const error = yield* startBrewing(order.id).pipe(
          Effect.provideService(CurrentActor, systemActor),
          Effect.provideService(OrderRepository, repository),
          Effect.flip,
        );
        assert.deepStrictEqual(
          error,
          new InternalAppError({ message: "Unable to update order status right now", cause }),
        );
        assert.deepStrictEqual(yield* Ref.get(test.saved), []);
        assert.deepStrictEqual(yield* Ref.get(test.stored), Option.some(order));
      }),
  );
});
