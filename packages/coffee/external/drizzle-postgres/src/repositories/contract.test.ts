import * as Option from "effect/Option";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as DateTime from "effect/DateTime";
import { sql } from "drizzle-orm";
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-testing/repository-contract";
import { CoffeeDb } from "../db/Db.ts";
import { usersTable } from "../db/auth-schema.ts";
import { DrizzlePostgresSchemaLive } from "../db/migrate.ts";
import { DrizzlePostgresSchemaReady } from "../db/schema-ready.ts";
import { DrizzlePostgresCoffeeAppLive } from "../live.ts";

type ContractServices =
  | CoffeeDb
  | CartRepository
  | CheckoutSessionIdGenerator
  | CheckoutSessionRepository
  | MenuRepository
  | OrderIdGenerator
  | OrderRepository;
type ContractRuntime = ManagedRuntime.ManagedRuntime<ContractServices, unknown>;
type RepositoryServices =
  | CartRepository
  | CheckoutSessionRepository
  | MenuRepository
  | OrderRepository;

const postgresTestUrl = process.env.COFFEE_POSTGRES_TEST_URL;
const describeWithPostgres = postgresTestUrl === undefined ? describe.skip : describe;

let runtime: Option.Option<ContractRuntime> = Option.none();

const getRuntime = () => {
  if (Option.isNone(runtime)) {
    assert.fail("Drizzle Postgres test runtime is not initialized");
  }

  return runtime.value;
};

const run = <A, E>(effect: Effect.Effect<A, E, ContractServices>) =>
  getRuntime().runPromise(effect);

const runRepositoryContract = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
  run(effect);

const resetDatabase = Effect.fn("contract.test.resetDatabase")(function* () {
  const db = yield* CoffeeDb;

  yield* db.execute(sql`delete from checkout_session_items`);
  yield* db.execute(sql`delete from checkout_sessions`);
  yield* db.execute(sql`delete from cart_items`);
  yield* db.execute(sql`delete from carts`);
  yield* db.execute(sql`delete from order_items`);
  yield* db.execute(sql`delete from orders`);
  yield* db.execute(sql`delete from "user" where id = 'native-driver-timestamp-test'`);
});

const orderIdPattern = /^order_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;
const checkoutSessionIdPattern = /^checkout_session_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;

describeWithPostgres("Drizzle Postgres coffee repositories", () => {
  beforeAll(async () => {
    if (postgresTestUrl !== undefined) {
      process.env.COFFEE_POSTGRES_URL = postgresTestUrl;
      runtime = Option.some(
        ManagedRuntime.make(DrizzlePostgresCoffeeAppLive.pipe(Layer.merge(CoffeeDb.layer))),
      );
      await getRuntime().context();
    }
  });

  beforeEach(async () => {
    await run(resetDatabase());
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

  it("generates TypeID-backed order ids", async () => {
    await run(
      Effect.gen(function* () {
        const orderIdGenerator = yield* OrderIdGenerator;

        const first = yield* orderIdGenerator.next;
        const second = yield* orderIdGenerator.next;

        expect(first).toMatch(orderIdPattern);
        expect(second).toMatch(orderIdPattern);
        expect(first).not.toBe(second);
      }),
    );
  });

  it("round-trips auth timestamps through the native PostgreSQL driver", async () => {
    await run(
      Effect.gen(function* () {
        const db = yield* CoffeeDb;
        const createdAt = DateTime.toDateUtc(DateTime.makeUnsafe("2026-09-12T12:34:56.789Z"));
        const rows = yield* db
          .insert(usersTable)
          .values({
            id: "native-driver-timestamp-test",
            name: "Native driver test",
            email: "native-driver@example.test",
            emailVerified: false,
            createdAt,
            updatedAt: createdAt,
          })
          .returning();

        expect(rows).toHaveLength(1);
        expect(rows[0]?.createdAt).toEqual(createdAt);
        expect(rows[0]?.updatedAt).toEqual(createdAt);
      }),
    );
  });

  it("generates TypeID-backed checkout session ids", async () => {
    await run(
      Effect.gen(function* () {
        const checkoutSessionIdGenerator = yield* CheckoutSessionIdGenerator;

        const first = yield* checkoutSessionIdGenerator.next;
        const second = yield* checkoutSessionIdGenerator.next;

        expect(first).toMatch(checkoutSessionIdPattern);
        expect(second).toMatch(checkoutSessionIdPattern);
        expect(first).not.toBe(second);
      }),
    );
  });

  defineRepositoryContract("repository contract", runRepositoryContract);
});
