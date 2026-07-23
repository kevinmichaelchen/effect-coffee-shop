/**
 * Runs the full repository contract against in-process Postgres.
 *
 * `pglite-test` boots a WASM Postgres (PGlite) inside the test runner — no
 * server, no containers — and the same Drizzle migrations and repositories
 * run against it via `drizzle-orm/effect-pglite`. Unlike `contract.test.ts`,
 * this suite needs no `COFFEE_POSTGRES_TEST_URL` and always runs.
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import { sql } from "drizzle-orm";
import { getConnections, type PgTestClient } from "pglite-test";
import { afterAll, assert, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { defineRepositoryContract } from "@effect-coffee-shop/coffee-core/application/testing/repository-contract";
import { menuItems } from "@effect-coffee-shop/coffee-core/domain/menu";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzlePgliteSchemaLive, makePgliteCoffeeDbLayer } from "../db/pglite.ts";
import { DrizzlePostgresSchemaReady } from "../db/schema-ready.ts";
import { DrizzleCoffeeAppLayer } from "../live.ts";

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

let runtime: ContractRuntime | undefined;
let superuser: PgTestClient | undefined;
let teardownPglite: (() => Promise<void>) | undefined;

const getRuntime = () => {
  if (runtime === undefined) {
    assert.fail("Drizzle PGlite test runtime is not initialized");
  }

  return runtime;
};

const getSuperuser = () => {
  if (superuser === undefined) {
    assert.fail("PGlite superuser client is not initialized");
  }

  return superuser;
};

const run = <A, E>(effect: Effect.Effect<A, E, ContractServices>) =>
  getRuntime().runPromise(effect);

const runRepositoryContract = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
  run(effect);

const resetDatabase = Effect.gen(function* () {
  const db = yield* CoffeeDb;

  yield* db.execute(sql`delete from checkout_session_items`);
  yield* db.execute(sql`delete from checkout_sessions`);
  yield* db.execute(sql`delete from cart_items`);
  yield* db.execute(sql`delete from carts`);
  yield* db.execute(sql`delete from order_items`);
  yield* db.execute(sql`delete from orders`);
});

const orderIdPattern = /^order_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;
const checkoutSessionIdPattern = /^checkout_session_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/;

describe("Drizzle PGlite coffee repositories", () => {
  beforeAll(async () => {
    const connections = await getConnections({ pglite: { roles: false } }, []);
    superuser = connections.pg;
    teardownPglite = connections.teardown;

    const coffeeDbLayer = makePgliteCoffeeDbLayer(connections.instance);
    runtime = ManagedRuntime.make(
      DrizzleCoffeeAppLayer.pipe(
        Layer.provide(DrizzlePgliteSchemaLive),
        Layer.provide(coffeeDbLayer),
      ).pipe(Layer.merge(coffeeDbLayer)),
    );
    await getRuntime().context();
  });

  beforeEach(async () => {
    await run(resetDatabase);
  });

  afterAll(async () => {
    await getRuntime().dispose();
    await teardownPglite?.();
  });

  it("applies migrations idempotently and keeps the schema ready", async () => {
    await run(
      Effect.gen(function* () {
        yield* DrizzlePostgresSchemaReady;
      }).pipe(Effect.provide(DrizzlePgliteSchemaLive)),
    );
  });

  it("seeds the menu into the same PGlite instance pglite-test exposes", async () => {
    const result = await getSuperuser().query<{ n: number }>(
      "select count(*)::int as n from menu_items",
    );

    expect(result.rows[0]?.n).toBe(menuItems.length);
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
