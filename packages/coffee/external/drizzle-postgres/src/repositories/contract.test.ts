import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Option from "effect/Option";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { menuItems } from "@effect-coffee-shop/coffee-core/domain/menu";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-core/domain/order";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzlePostgresSchemaLive } from "../db/migrate.ts";
import { DrizzlePostgresSchemaReady } from "../db/schema-ready.ts";
import { DrizzlePostgresCoffeeAppLive } from "../live.ts";

type ContractServices = CoffeeDb | MenuRepository | OrderIdGenerator | OrderRepository;
type ContractRuntime = ManagedRuntime.ManagedRuntime<ContractServices, unknown>;

const postgresTestUrl = process.env.COFFEE_POSTGRES_TEST_URL;
const describeWithPostgres = postgresTestUrl === undefined ? describe.skip : describe;

let runtime: ContractRuntime | undefined;

const getRuntime = () => {
  if (runtime === undefined) {
    throw new Error("Drizzle Postgres test runtime is not initialized");
  }

  return runtime;
};

const run = <A, E>(effect: Effect.Effect<A, E, ContractServices>) =>
  getRuntime().runPromise(effect);

const utc = (iso: string) => Option.getOrThrow(DateTime.make(iso));

const makeOrder = ({
  id,
  ...overrides
}: Partial<CoffeeOrder> & Pick<CoffeeOrder, "id">): CoffeeOrder => ({
  id,
  customerName: "Avery",
  ownerUserId: "user-avery",
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

const resetDatabase = Effect.gen(function* () {
  const db = yield* CoffeeDb;

  yield* db.execute(sql`delete from orders`);
  yield* db.execute(sql`alter sequence coffee_order_id_seq restart with 1`);
});

describeWithPostgres("Drizzle Postgres coffee repositories", () => {
  beforeAll(async () => {
    if (postgresTestUrl !== undefined) {
      process.env.COFFEE_POSTGRES_URL = postgresTestUrl;
      runtime = ManagedRuntime.make(DrizzlePostgresCoffeeAppLive.pipe(Layer.merge(CoffeeDb.layer)));
      await getRuntime().context();
    }
  });

  beforeEach(async () => {
    await run(resetDatabase);
  });

  afterAll(async () => {
    await getRuntime().dispose();
  });

  it("applies migrations idempotently and keeps the schema ready", async () => {
    await run(
      Effect.gen(function* () {
        yield* DrizzlePostgresSchemaReady;
      }).pipe(Effect.provide(DrizzlePostgresSchemaLive)),
    );
  });

  it("lists the seeded menu and supports id lookups", async () => {
    await run(
      Effect.gen(function* () {
        const menuRepository = yield* MenuRepository;
        const menu = yield* menuRepository.list;
        const latte = yield* menuRepository.findById("latte");
        const missing = yield* menuRepository.findById("mocha");

        expect(menu).toEqual(menuItems);
        expect(latte).toEqual(
          Option.fromUndefinedOr(menuItems.find((item) => item.id === "latte")),
        );
        expect(missing).toEqual(Option.none());
      }),
    );
  });

  it("generates sequence-backed order ids", async () => {
    await run(
      Effect.gen(function* () {
        const orderIdGenerator = yield* OrderIdGenerator;

        const first = yield* orderIdGenerator.next;
        const second = yield* orderIdGenerator.next;

        expect(first).toBe("order-0001");
        expect(second).toBe("order-0002");
      }),
    );
  });

  it("round-trips saved orders with and without notes", async () => {
    await run(
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const notedOrder = makeOrder({
          id: "order-0001",
          notes: "no foam",
        });
        const plainOrder = makeOrder({
          id: "order-0002",
          createdAt: utc("2026-01-01T10:05:00.000Z"),
        });

        const savedNotedOrder = yield* orderRepository.save(notedOrder);
        const savedPlainOrder = yield* orderRepository.save(plainOrder);
        const loadedNotedOrder = yield* orderRepository.getById(notedOrder.id);
        const loadedPlainOrder = yield* orderRepository.getById(plainOrder.id);

        expect(savedNotedOrder).toEqual(notedOrder);
        expect(savedPlainOrder).toEqual(plainOrder);
        expect(loadedNotedOrder).toEqual(Option.some(notedOrder));
        expect(loadedPlainOrder).toEqual(Option.some(plainOrder));
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

        expect(saved).toEqual(updated);
        expect(loaded).toEqual(Option.some(updated));
        expect(allOrders).toEqual([updated]);
      }),
    );
  });

  it("lists orders in createdAt order and filters by status and owner", async () => {
    await run(
      Effect.gen(function* () {
        const orderRepository = yield* OrderRepository;
        const averyPending = makeOrder({
          id: "order-0001",
          createdAt: utc("2026-01-01T10:00:00.000Z"),
          ownerUserId: "user-avery",
          status: "pending",
        });
        const averyReady = makeOrder({
          id: "order-0002",
          createdAt: utc("2026-01-01T10:05:00.000Z"),
          ownerUserId: "user-avery",
          status: "ready",
        });
        const blakeReady = makeOrder({
          id: "order-0003",
          createdAt: utc("2026-01-01T10:10:00.000Z"),
          ownerUserId: "user-blake",
          status: "ready",
        });

        yield* orderRepository.save(blakeReady);
        yield* orderRepository.save(averyReady);
        yield* orderRepository.save(averyPending);

        const allOrders = yield* orderRepository.list();
        const readyOrders = yield* orderRepository.list({ status: "ready" });
        const averyOrders = yield* orderRepository.list({ ownerUserId: "user-avery" });
        const averyReadyOrders = yield* orderRepository.list({
          ownerUserId: "user-avery",
          status: "ready",
        });

        expect(allOrders).toEqual([averyPending, averyReady, blakeReady]);
        expect(readyOrders).toEqual([averyReady, blakeReady]);
        expect(averyOrders).toEqual([averyPending, averyReady]);
        expect(averyReadyOrders).toEqual([averyReady]);
      }),
    );
  });
});
