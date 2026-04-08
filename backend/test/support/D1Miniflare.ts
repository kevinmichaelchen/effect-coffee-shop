import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { D1Client } from "@effect/sql-d1";
import { SqlCoffeeRepositoriesLive } from "#external/live";

class D1Miniflare extends ServiceMap.Service<D1Miniflare, Miniflare>()("test/D1Miniflare") {
  static readonly layer = Layer.effect(this)(
    Effect.acquireRelease(
      Effect.sync(
        () =>
          new Miniflare({
            modules: true,
            d1Databases: {
              DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
            },
            script: "",
          }),
      ),
      (miniflare) => Effect.tryPromise(() => miniflare.dispose()),
    ),
  );

  static readonly layerClient = Layer.unwrap(
    Effect.gen(function* () {
      const miniflare = yield* D1Miniflare;
      const db: D1Database = yield* Effect.tryPromise(() => miniflare.getD1Database("DB"));
      return D1Client.layer({ db });
    }),
  ).pipe(Layer.provide(this.layer));
}

export const SqlCoffeeRepositoriesTestLive = SqlCoffeeRepositoriesLive.pipe(
  Layer.provide(D1Miniflare.layerClient),
);
