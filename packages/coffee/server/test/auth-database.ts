import * as NodeServices from "@effect/platform-node/NodeServices";
import { d1AuthDatabase } from "@effect-coffee-shop/coffee-auth/adapters/d1";
import type { AuthDatabase } from "@effect-coffee-shop/coffee-auth/server";
import { migrateCloudflareD1 } from "@effect-coffee-shop/coffee-auth/testing/migrate";
import * as Effect from "effect/Effect";
import { Miniflare } from "miniflare";

/** A migrated D1 auth database in a local Workers runtime. */
export const authDatabase = Effect.fn("authDatabase")(function* () {
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
  return d1AuthDatabase(db) satisfies AuthDatabase;
});
