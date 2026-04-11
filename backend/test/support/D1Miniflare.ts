import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { D1Client } from "@effect/sql-d1";
import { SqlCoffeeRepositoriesLive } from "#external/live";
import type { PersistenceError } from "#service/errors";
import { MenuRepository } from "#service/ports/MenuRepository";
import { OrderRepository } from "#service/ports/OrderRepository";

type RepositoryServices = MenuRepository | OrderRepository;

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
    const repositoryLayer = SqlCoffeeRepositoriesLive.pipe(Layer.provide(D1Client.layer({ db })));

    const repositories = await Effect.runPromise(
      Effect.gen(function* () {
        return {
          menuRepository: yield* MenuRepository,
          orderRepository: yield* OrderRepository,
        };
      }).pipe(Effect.provide(repositoryLayer)),
    );

    const providedRepositories = Layer.mergeAll(
      Layer.succeed(MenuRepository)(repositories.menuRepository),
      Layer.succeed(OrderRepository)(repositories.orderRepository),
    );

    const run = <A>(effect: Effect.Effect<A, PersistenceError, RepositoryServices>) =>
      Effect.runPromise(effect.pipe(Effect.provide(providedRepositories)));

    const reset = () =>
      db
        .prepare("DELETE FROM orders")
        .run()
        .then(() => undefined);

    return {
      run,
      reset,
      dispose: () => miniflare.dispose(),
    };
  };
