import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { assert, describe, it } from "@effect/vitest";
import { menuItems } from "../../domain/menu.ts";
import { moneyFromCents } from "../../domain/money.ts";
import type { Cart } from "../../domain/cart.ts";
import type { CoffeeOrder } from "../../domain/order.ts";
import type { PersistenceError } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";

type RepositoryServices = CartRepository | MenuRepository | OrderRepository;
type RunTest = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) => Promise<A>;

const utc = (iso: string) => Option.getOrThrow(DateTime.make(iso));
const initialTime = utc("2026-01-01T10:00:00.000Z");
const laterTime = utc("2026-01-01T10:05:00.000Z");
const latestTime = utc("2026-01-01T10:10:00.000Z");

const makeOrder = ({
  id,
  ...overrides
}: Partial<CoffeeOrder> & Pick<CoffeeOrder, "id">): CoffeeOrder => ({
  id,
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
      unitPrice: moneyFromCents(500),
      lineTotal: moneyFromCents(500),
    },
  ],
  status: "pending",
  totalPrice: moneyFromCents(500),
  createdAt: initialTime,
  ...overrides,
});

const makeReadyOrder = ({
  id,
  createdAt = laterTime,
  ownerUserId = "user-avery",
}: Pick<CoffeeOrder, "id"> & Partial<Pick<CoffeeOrder, "createdAt" | "ownerUserId">>) =>
  makeOrder({ id, createdAt, ownerUserId, status: "ready" });

export const defineRepositoryContract = (name: string, run: RunTest) => {
  describe(name, () => {
    const itContract = (
      caseName: string,
      effect: Effect.Effect<void, PersistenceError, RepositoryServices>,
    ) => {
      it(caseName, async () => {
        await run(effect);
      });
    };

    itContract(
      "lists the seeded menu and supports id lookups",
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

    itContract(
      "round-trips saved orders",
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const order = makeOrder({
          id: "order-0001",
          items: [
            {
              drinkId: "latte",
              drinkName: "Latte",
              size: "medium",
              milk: "whole",
              temperature: "hot",
              shots: 1,
              notes: "no foam",
              quantity: 1,
              unitPrice: moneyFromCents(500),
              lineTotal: moneyFromCents(500),
            },
          ],
        });

        const saved = yield* orderRepository.save(order);
        const loaded = yield* orderRepository.getById(order.id);

        assert.deepStrictEqual(saved, order);
        assert.deepStrictEqual(loaded, Option.some(order));
      }),
    );

    itContract(
      "round-trips and clears actor carts",
      Effect.gen(function* () {
        const cartRepository = yield* CartRepository;
        const cart = {
          ownerUserId: "user-avery",
          items: [
            {
              id: "cart-item-0001",
              drinkId: "latte",
              size: "medium",
              milk: "oat",
              temperature: "hot",
              shots: 2,
              quantity: 2,
              notes: "extra foam",
            },
          ],
        } satisfies Cart;

        const saved = yield* cartRepository.save(cart);
        const loaded = yield* cartRepository.getByOwnerUserId(cart.ownerUserId);
        const cleared = yield* cartRepository.clear(cart.ownerUserId);
        const afterClear = yield* cartRepository.getByOwnerUserId(cart.ownerUserId);

        assert.deepStrictEqual(saved, cart);
        assert.deepStrictEqual(loaded, Option.some(cart));
        assert.deepStrictEqual(cleared, { ownerUserId: cart.ownerUserId, items: [] });
        assert.deepStrictEqual(afterClear, Option.none());
      }),
    );

    itContract(
      "replaces existing orders when saving the same id again",
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const original = makeOrder({ id: "order-0001" });
        const updated = makeOrder({
          id: "order-0001",
          status: "ready",
          items: [
            {
              drinkId: "latte",
              drinkName: "Latte",
              size: "medium",
              milk: "whole",
              temperature: "hot",
              shots: 2,
              notes: "call customer",
              quantity: 1,
              unitPrice: moneyFromCents(575),
              lineTotal: moneyFromCents(575),
            },
          ],
          totalPrice: moneyFromCents(575),
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

    itContract(
      "lists orders in createdAt order and filters by status",
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const laterReady = makeReadyOrder({ id: "order-0002" });
        const earlierPending = makeOrder({ id: "order-0001" });

        yield* orderRepository.save(laterReady);
        yield* orderRepository.save(earlierPending);

        const allOrders = yield* orderRepository.list();
        const readyOrders = yield* orderRepository.list({ status: "ready" });

        assert.deepStrictEqual(allOrders, [earlierPending, laterReady]);
        assert.deepStrictEqual(readyOrders, [laterReady]);
      }),
    );

    itContract(
      "filters orders by owner and by owner plus status",
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const averyPending = makeOrder({ id: "order-0001" });
        const averyReady = makeReadyOrder({ id: "order-0002" });
        const blakeReady = makeReadyOrder({
          id: "order-0003",
          createdAt: latestTime,
          ownerUserId: "user-blake",
        });

        yield* orderRepository.save(blakeReady);
        yield* orderRepository.save(averyReady);
        yield* orderRepository.save(averyPending);

        const averyOrders = yield* orderRepository.list({ ownerUserId: "user-avery" });
        const averyReadyOrders = yield* orderRepository.list({
          ownerUserId: "user-avery",
          status: "ready",
        });

        assert.deepStrictEqual(averyOrders, [averyPending, averyReady]);
        assert.deepStrictEqual(averyReadyOrders, [averyReady]);
      }),
    );
  });
};
