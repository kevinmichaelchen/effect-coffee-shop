import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { assert, describe, it } from "@effect/vitest";
import { menuItems } from "../../domain/menu.ts";
import { moneyFromCents } from "../../domain/money.ts";
import { CartSchema } from "../../domain/cart.ts";
import { CheckoutSessionSchema, type CheckoutSession } from "../../domain/checkout-session.ts";
import { CoffeeOrderSchema, type CoffeeOrder } from "../../domain/order.ts";
import type { PersistenceError } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { CheckoutSessionRepository } from "../ports/CheckoutSessionRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";

type RepositoryServices =
  | CartRepository
  | CheckoutSessionRepository
  | MenuRepository
  | OrderRepository;
type RunTest = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) => Promise<A>;
type CoffeeOrderOverrides = {
  readonly id: string;
  readonly createdAt?: CoffeeOrder["createdAt"];
  readonly customerName?: string;
  readonly items?: unknown;
  readonly ownerUserId?: string;
  readonly status?: CoffeeOrder["status"];
  readonly totalPrice?: CoffeeOrder["totalPrice"];
};
type CheckoutSessionOverrides = {
  readonly id: string;
  readonly createdAt?: CheckoutSession["createdAt"];
  readonly expiresAt?: CheckoutSession["expiresAt"];
  readonly items?: unknown;
  readonly ownerUserId?: string;
  readonly totalPrice?: CheckoutSession["totalPrice"];
  readonly updatedAt?: CheckoutSession["updatedAt"];
};

const utc = DateTime.makeUnsafe;
const initialTime = utc("2026-01-01T10:00:00.000Z");
const laterTime = utc("2026-01-01T10:05:00.000Z");
const latestTime = utc("2026-01-01T10:10:00.000Z");
const decodeCart = Schema.decodeUnknownSync(CartSchema);
const decodeCheckoutSession = Schema.decodeUnknownSync(CheckoutSessionSchema);
const decodeCoffeeOrder = Schema.decodeUnknownSync(CoffeeOrderSchema);

const makeOrder = ({ id, ...overrides }: CoffeeOrderOverrides): CoffeeOrder =>
  decodeCoffeeOrder({
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
}: { readonly id: string } & Partial<Pick<CoffeeOrder, "createdAt" | "ownerUserId">>) =>
  makeOrder({ id, createdAt, ownerUserId, status: "ready" });

const makeCheckoutSession = ({
  id,
  createdAt = initialTime,
  expiresAt = latestTime,
  ownerUserId = "user-avery",
  totalPrice = moneyFromCents(500),
  updatedAt = initialTime,
  ...overrides
}: CheckoutSessionOverrides): CheckoutSession =>
  decodeCheckoutSession({
    id,
    ownerUserId,
    status: "awaiting_confirmation",
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
    totalPrice,
    createdAt,
    updatedAt,
    expiresAt,
    ...overrides,
  });

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
          id: "order_00000000000000000000000001",
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
        const cart = decodeCart({
          ownerUserId: "user-avery",
          items: [
            {
              id: "cart_item_00000000000000000000000001",
              drinkId: "latte",
              size: "medium",
              milk: "oat",
              temperature: "hot",
              shots: 2,
              quantity: 2,
              notes: "extra foam",
            },
          ],
        });

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
      "round-trips checkout sessions and tracks the current actor session",
      Effect.gen(function* () {
        const checkoutSessionRepository = yield* CheckoutSessionRepository;
        const earlierAverySession = makeCheckoutSession({
          id: "checkout_session_00000000000000000000000001",
          updatedAt: initialTime,
        });
        const laterAverySession = makeCheckoutSession({
          id: "checkout_session_00000000000000000000000002",
          updatedAt: laterTime,
          totalPrice: moneyFromCents(575),
          items: [
            {
              drinkId: "latte",
              drinkName: "Latte",
              size: "medium",
              milk: "whole",
              temperature: "hot",
              shots: 2,
              quantity: 1,
              unitPrice: moneyFromCents(575),
              lineTotal: moneyFromCents(575),
            },
          ],
        });
        const blakeSession = makeCheckoutSession({
          id: "checkout_session_00000000000000000000000003",
          ownerUserId: "user-blake",
          updatedAt: latestTime,
        });

        yield* checkoutSessionRepository.save(earlierAverySession);
        yield* checkoutSessionRepository.save(blakeSession);
        const saved = yield* checkoutSessionRepository.save(laterAverySession);
        const loaded = yield* checkoutSessionRepository.getById(laterAverySession.id);
        const currentAvery = yield* checkoutSessionRepository.getCurrentByOwnerUserId("user-avery");
        const currentBlake = yield* checkoutSessionRepository.getCurrentByOwnerUserId("user-blake");

        yield* checkoutSessionRepository.clearCurrentByOwnerUserId("user-avery");
        const averyAfterClear =
          yield* checkoutSessionRepository.getCurrentByOwnerUserId("user-avery");

        assert.deepStrictEqual(saved, laterAverySession);
        assert.deepStrictEqual(loaded, Option.some(laterAverySession));
        assert.deepStrictEqual(currentAvery, Option.some(laterAverySession));
        assert.deepStrictEqual(currentBlake, Option.some(blakeSession));
        assert.deepStrictEqual(averyAfterClear, Option.some(earlierAverySession));
      }),
    );

    itContract(
      "replaces existing orders when saving the same id again",
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const original = makeOrder({ id: "order_00000000000000000000000001" });
        const updated = makeOrder({
          id: "order_00000000000000000000000001",
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
        const laterReady = makeReadyOrder({ id: "order_00000000000000000000000002" });
        const earlierPending = makeOrder({ id: "order_00000000000000000000000001" });

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
        const averyPending = makeOrder({ id: "order_00000000000000000000000001" });
        const averyReady = makeReadyOrder({ id: "order_00000000000000000000000002" });
        const blakeReady = makeReadyOrder({
          id: "order_00000000000000000000000003",
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
