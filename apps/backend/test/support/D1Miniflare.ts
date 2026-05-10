import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { D1Client } from "@effect/sql-d1";
import { SqlCoffeeRepositoriesLive } from "@effect-coffee-shop/coffee-external-sqlite";
import { makeCloudflareSqlCoffeeSchemaLive } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { MenuRepository } from "@effect-coffee-shop/coffee-core/application/ports/MenuRepository";
import { OrderRepository } from "@effect-coffee-shop/coffee-core/application/ports/OrderRepository";

type RepositoryServices = CartRepository | MenuRepository | OrderRepository;

export type SqlCoffeeRepositoriesTestHarness = {
  readonly run: <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) => Promise<A>;
  readonly reset: () => Promise<void>;
  readonly dispose: () => Promise<void>;
};

const createD1Miniflare = () =>
  new Miniflare({
    modules: true,
    d1Databases: {
      DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    script: "",
  });

export const createSqlCoffeeRepositoriesTestHarness =
  async (): Promise<SqlCoffeeRepositoriesTestHarness> => {
    const miniflare = createD1Miniflare();
    const db: D1Database = await miniflare.getD1Database("DB");
    const repositoryLayer = SqlCoffeeRepositoriesLive.pipe(
      Layer.provide(D1Client.layer({ db })),
      Layer.provide(makeCloudflareSqlCoffeeSchemaLive(db)),
    );

    const repositories = await Effect.runPromise(
      Effect.gen(function* () {
        return {
          menuRepository: yield* MenuRepository,
          cartRepository: yield* CartRepository,
          orderRepository: yield* OrderRepository,
        };
      }).pipe(Effect.provide(repositoryLayer)),
    );

    const providedRepositories = Layer.mergeAll(
      Layer.succeed(MenuRepository)(repositories.menuRepository),
      Layer.succeed(CartRepository)(repositories.cartRepository),
      Layer.succeed(OrderRepository)(repositories.orderRepository),
    );

    const run = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
      Effect.runPromise(effect.pipe(Effect.provide(providedRepositories)));

    const reset = () =>
      db
        .batch([
          db.prepare("DELETE FROM cart_items"),
          db.prepare("DELETE FROM carts"),
          db.prepare("DELETE FROM order_items"),
          db.prepare("DELETE FROM orders"),
        ])
        .then(() => undefined);

    return {
      run,
      reset,
      dispose: () => miniflare.dispose(),
    };
  };
