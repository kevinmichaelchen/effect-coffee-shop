import * as NodeServices from "@effect/platform-node/NodeServices";
import { expect, it } from "@effect/vitest";
import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { KeyValueStore } from "effect/persistence";
import { SqlClient } from "effect/sql";
import { migrateCloudflareD1 } from "./testing/migrate.ts";
import { AuthRateLimitStoreLive } from "./persistence/rate-limit-store.ts";
import { d1AuthDatabase } from "./adapters/d1.ts";

/** A migrated, empty D1 database in Miniflare, for the test's own scope. */
const withDatabase = <A, E, R>(use: (db: D1Database) => Effect.Effect<A, E, R>) =>
  Effect.scoped(
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
      return yield* use(db);
    }),
  );

it.live(
  "round-trips persisted rate-limit entries across fresh D1 layer scopes",
  () =>
    withDatabase((db) =>
      Effect.gen(function* () {
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
    ),
  // Miniflare cold startup competes with other workspaces in the affected suite.
  30_000,
);

it.live(
  "hides expired buckets and prunes them on the next write",
  () =>
    withDatabase((db) =>
      Effect.gen(function* () {
        const kv = yield* KeyValueStore.KeyValueStore;
        const sql = yield* SqlClient.SqlClient;
        // Epoch is always behind the clock: a bucket nobody checked for longer than its TTL.
        yield* sql`insert into coffee_auth_rate_limits (id, value, expires_at) values (${"stale"}, ${"old"}, ${0})`;

        expect(yield* kv.get("stale")).toBeUndefined();
        expect(yield* kv.size).toBe(0);
        expect(yield* kv.keys).toEqual([]);

        yield* kv.set("probe", "hello");
        const ids = yield* sql`select id from coffee_auth_rate_limits order by id`.pipe(
          Effect.flatMap(
            Schema.decodeUnknownEffect(Schema.Array(Schema.Struct({ id: Schema.String }))),
          ),
          Effect.map((rows) => rows.map((row) => row.id)),
        );
        expect(ids).toEqual(["probe"]);
      }).pipe(
        Effect.provide(
          Layer.merge(
            AuthRateLimitStoreLive.pipe(Layer.provide(d1AuthDatabase(db))),
            d1AuthDatabase(db),
          ),
        ),
      ),
    ),
  30_000,
);
