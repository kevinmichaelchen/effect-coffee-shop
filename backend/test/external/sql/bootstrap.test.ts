import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { D1Client } from "@effect/sql-d1";
import { SqlClient } from "effect/unstable/sql";
import { SqlCoffeeBootstrapLive } from "#external/sql/bootstrap";

describe("SqlCoffeeBootstrapLive", () => {
  let miniflare: Miniflare;
  let db: D1Database;

  beforeAll(async () => {
    miniflare = new Miniflare({
      modules: true,
      d1Databases: { DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" },
      script: "",
    });
    db = await miniflare.getD1Database("DB");
  });

  afterAll(async () => {
    await miniflare.dispose();
  });

  it("records each migration exactly once across multiple acquisitions", async () => {
    const acquire = Effect.runPromise(
      Effect.scoped(
        Layer.build(SqlCoffeeBootstrapLive.pipe(Layer.provide(D1Client.layer({ db })))).pipe(
          Effect.asVoid,
        ),
      ),
    );

    await acquire;
    await acquire;
    await acquire;

    const countMigrations = Effect.runPromise(
      Effect.provide(
        Effect.gen(function* () {
          const sql = yield* SqlClient.SqlClient;
          const rows = yield* sql<{
            readonly count: number;
          }>`SELECT COUNT(*) AS count FROM _coffee_migrations`;
          return rows[0]?.count ?? 0;
        }),
        D1Client.layer({ db }),
      ),
    );

    expect(await countMigrations).toBe(1);
  });
});
