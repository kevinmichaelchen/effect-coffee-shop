import * as NodeServices from "@effect/platform-node/NodeServices";
import { migrateCloudflareD1 } from "@effect-coffee-shop/coffee-external-sqlite/cloudflare";
import { AuthRateLimitStoreLive } from "./persistence/rate-limit-store.ts";
/* oxlint-disable effect/effect-run-in-body -- Vitest owns the native test boundary. */
import { expect, it } from "vitest";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { KeyValueStore } from "effect/persistence";
import { d1AuthDatabase } from "./database.ts";

it("round-trips persisted rate-limit entries across fresh D1 layer scopes", async () => {
  const proxy = new Miniflare({
    modules: true,
    script: "export default { fetch() { return new Response(); } }",
    d1Databases: ["DB"],
  });
  const db = await proxy.getD1Database("DB");
  const run = async () => {
    await Effect.runPromise(migrateCloudflareD1(db).pipe(Effect.provide(NodeServices.layer)));
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* KeyValueStore.KeyValueStore;
        yield* store.set("probe", "hello");
        return yield* store.get("probe");
      }).pipe(Effect.provide(AuthRateLimitStoreLive.pipe(Layer.provide(d1AuthDatabase(db))))),
    );
    expect(result).toBe("hello");
    const next = await Effect.runPromise(
      KeyValueStore.KeyValueStore.use((store) => store.get("probe")).pipe(
        Effect.provide(AuthRateLimitStoreLive.pipe(Layer.provide(d1AuthDatabase(db)))),
      ),
    );
    expect(next).toBe("hello");
  };
  await run().finally(() => proxy.dispose());
  // Miniflare cold startup competes with other workspaces in the affected suite.
}, 30_000);
