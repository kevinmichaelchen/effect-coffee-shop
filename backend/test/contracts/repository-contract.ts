import { assert } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { describe, it } from "vitest";
import { menuItems } from "#domain/menu";
import type { CoffeeOrder } from "#domain/order";
import type { PersistenceError } from "#service/errors";
import { MenuRepository } from "#service/ports/MenuRepository";
import { OrderRepository } from "#service/ports/OrderRepository";

type RepositoryServices = MenuRepository | OrderRepository;
type RunTest = <A>(
  effect: Effect.Effect<A, PersistenceError, RepositoryServices>,
) => Promise<A>;

const utc = (iso: string) => Option.getOrThrow(DateTime.make(iso));

const makeOrder = ({
  id,
  ...overrides
}: Partial<CoffeeOrder> & Pick<CoffeeOrder, "id">): CoffeeOrder => ({
  id,
  customerName: "Avery",
  drinkId: "latte",
  drinkName: "Latte",
  size: "medium",
  milk: "whole",
  temperature: "hot",
  shots: 1,
  status: "pending",
  priceCents: 500,
  createdAt: utc("2026-01-01T10:00:00.000Z"),
  ...overrides,
});

export const defineRepositoryContract = (name: string, run: RunTest) => {
  describe(name, () => {
    it("lists the seeded menu and supports id lookups", async () => {
      await run(
        Effect.gen(function* () {
          const menuRepository = yield* MenuRepository;
          const menu = yield* menuRepository.list;
          const latte = yield* menuRepository.findById("latte");
          const missing = yield* menuRepository.findById("mocha");

          assert.deepStrictEqual(menu, menuItems);
          assert.deepStrictEqual(
            latte,
            Option.fromUndefinedOr(menuItems.find((item) => item.id === "latte")),
          );
          assert.deepStrictEqual(missing, Option.none());
        }),
      );
    });

    it("round-trips saved orders", async () => {
      await run(
        Effect.gen(function* () {
          const orderRepository = yield* OrderRepository;
          const order = makeOrder({
            id: "order-0001",
            notes: "no foam",
          });

          const saved = yield* orderRepository.save(order);
          const loaded = yield* orderRepository.getById(order.id);

          assert.deepStrictEqual(saved, order);
          assert.deepStrictEqual(loaded, Option.some(order));
        }),
      );
    });

    it("replaces existing orders when saving the same id again", async () => {
      await run(
        Effect.gen(function* () {
          const orderRepository = yield* OrderRepository;
          const original = makeOrder({ id: "order-0001" });
          const updated = makeOrder({
            id: "order-0001",
            status: "ready",
            notes: "call customer",
            shots: 2,
          });

          yield* orderRepository.save(original);
          const saved = yield* orderRepository.save(updated);
          const loaded = yield* orderRepository.getById(updated.id);
          const allOrders = yield* orderRepository.list();

          assert.deepStrictEqual(saved, updated);
          assert.deepStrictEqual(loaded, Option.some(updated));
          assert.deepStrictEqual(allOrders, [updated]);
        }),
      );
    });

    it("lists orders in createdAt order and filters by status", async () => {
      await run(
        Effect.gen(function* () {
          const orderRepository = yield* OrderRepository;
          const laterReady = makeOrder({
            id: "order-0002",
            createdAt: utc("2026-01-01T10:05:00.000Z"),
            status: "ready",
          });
          const earlierPending = makeOrder({
            id: "order-0001",
            createdAt: utc("2026-01-01T10:00:00.000Z"),
            status: "pending",
          });

          yield* orderRepository.save(laterReady);
          yield* orderRepository.save(earlierPending);

          const allOrders = yield* orderRepository.list();
          const readyOrders = yield* orderRepository.list({ status: "ready" });

          assert.deepStrictEqual(allOrders, [earlierPending, laterReady]);
          assert.deepStrictEqual(readyOrders, [laterReady]);
        }),
      );
    });
  });
};
