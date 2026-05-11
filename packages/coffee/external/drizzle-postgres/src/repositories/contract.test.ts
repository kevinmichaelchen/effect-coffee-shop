import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { PendingOrderConfirmationRepository } from "@effect-coffee-shop/coffee-core/application/ports/PendingOrderConfirmationRepository";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzlePostgresSchemaLive } from "../db/migrate.ts";
import { DrizzlePostgresSchemaReady } from "../db/schema-ready.ts";
import { DrizzlePostgresCoffeeAppLive } from "../live.ts";

type ContractServices =
  | CoffeeDb
  | CartRepository
  | MenuRepository
  | OrderIdGenerator
  | OrderRepository
  | PendingOrderConfirmationRepository;
type ContractRuntime = ManagedRuntime.ManagedRuntime<ContractServices, unknown>;
type RepositoryServices =
  | CartRepository
  | MenuRepository
  | OrderRepository
  | PendingOrderConfirmationRepository;

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

const runRepositoryContract = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
  run(effect);

const resetDatabase = Effect.gen(function* () {
  const db = yield* CoffeeDb;

  yield* db.execute(sql`delete from pending_order_confirmation_items`);
  yield* db.execute(sql`delete from pending_order_confirmations`);
  yield* db.execute(sql`delete from cart_items`);
  yield* db.execute(sql`delete from carts`);
  yield* db.execute(sql`delete from order_items`);
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

  defineRepositoryContract("repository contract", runRepositoryContract);
});
