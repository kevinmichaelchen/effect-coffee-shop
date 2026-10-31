import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { KeyValueStore } from "effect/persistence";
import { migrateCloudflareD1 } from "./testing/migrate.ts";
import { AuthRateLimitStoreLive } from "./persistence/rate-limit-store.ts";
import { d1AuthDatabase } from "./database.ts";

it.live(
  "round-trips persisted rate-limit entries across fresh D1 layer scopes",
  () =>
    Effect.gen(function* () {
      const proxy = yield* Effect.acquireRelease(
        Effect.sync(
          () =>
            new Miniflare({
              modules: true,
              script: "export default { fetch() { return new Response(); } }",
              d1Databases: ["DB"],
            }),
        ),
        (proxy) => Effect.promise(async () => proxy.dispose()),
      );
      const db = yield* Effect.promise(async () => proxy.getD1Database("DB"));
      yield* migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer));
      // Each provide builds a fresh store layer, so the second read proves persistence.
      const store = AuthRateLimitStoreLive.pipe(Layer.provide(d1AuthDatabase(db)));
      const written = yield* KeyValueStore.KeyValueStore.use((kv) =>
        Effect.andThen(kv.set("probe", "hello"), kv.get("probe")),
      ).pipe(Effect.provide(store));
      expect(written).toBe("hello");
      const reread = yield* KeyValueStore.KeyValueStore.use((kv) => kv.get("probe")).pipe(
        Effect.provide(store),
      );
      expect(reread).toBe("hello");
    }),
  // Miniflare cold startup competes with other workspaces in the affected suite.
  30_000,
);
