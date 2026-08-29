import type { D1Database } from "@cloudflare/workers-types";
import { D1 } from "@alchemy.run/cloudflare-runtime/core/bindings";
import { getPlatformProxy } from "@alchemy.run/cloudflare-runtime/core/platform-proxy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { D1Client } from "@effect/sql-d1";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";
import { makeCloudflareSqlCoffeeSchemaLive } from "../cloudflare/live.ts";
import { SqlCoffeeRepositoriesLive } from "../sql/live.ts";

type RepositoryServices =
  | CartRepository
  | CheckoutSessionRepository
  | MenuRepository
  | OrderRepository;

export type SqlCoffeeRepositoriesTestHarness = {
  readonly run: <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) => Promise<A>;
  readonly reset: () => Promise<void>;
  readonly dispose: () => Promise<void>;
};

const createD1AlchemyProxy = () =>
  getPlatformProxy<{ readonly DB: D1Database }>({
    bindings: [D1.local({ binding: "DB" })],
    name: "coffee-sql-repositories-test",
  });

export const createSqlCoffeeRepositoriesTestHarness =
  async (): Promise<SqlCoffeeRepositoriesTestHarness> => {
    const proxy = await createD1AlchemyProxy();
    const db = proxy.env.DB;
    const repositoryLayer = SqlCoffeeRepositoriesLive.pipe(
      Layer.provide(D1Client.layer({ db })),
      Layer.provide(makeCloudflareSqlCoffeeSchemaLive(db)),
    );

    const repositories = await Effect.runPromise(
      Effect.gen(function* () {
        return {
          menuRepository: yield* MenuRepository,
          cartRepository: yield* CartRepository,
          checkoutSessionRepository: yield* CheckoutSessionRepository,
          orderRepository: yield* OrderRepository,
        };
      }).pipe(Effect.provide(repositoryLayer)),
    );

    const providedRepositories = Layer.mergeAll(
      Layer.succeed(MenuRepository)(repositories.menuRepository),
      Layer.succeed(CartRepository)(repositories.cartRepository),
      Layer.succeed(CheckoutSessionRepository)(repositories.checkoutSessionRepository),
      Layer.succeed(OrderRepository)(repositories.orderRepository),
    );

    const run = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
      Effect.runPromise(effect.pipe(Effect.provide(providedRepositories)));

    const reset = () =>
      db
        .exec(`
          DELETE FROM checkout_session_items;
          DELETE FROM checkout_sessions;
          DELETE FROM cart_items;
          DELETE FROM carts;
          DELETE FROM order_items;
          DELETE FROM orders;
        `)
        .then(() => undefined);

    return {
      run,
      reset,
      dispose: () => proxy.dispose(),
    };
  };
