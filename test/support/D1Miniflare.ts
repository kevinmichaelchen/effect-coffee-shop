import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import { SqlCoffeeAppLive, SqlCoffeeRepositoriesLive } from "../../src/external/live.ts";
import { D1Client } from "../../vendor/effect-smol/packages/sql/d1/src/index.ts";

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
      (miniflare) => Effect.promise(() => miniflare.dispose()),
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

export const SqlCoffeeAppTestLive = SqlCoffeeAppLive.pipe(Layer.provide(D1Miniflare.layerClient));
