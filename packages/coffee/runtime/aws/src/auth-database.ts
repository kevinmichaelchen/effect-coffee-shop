import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgAsyncDatabase } from "drizzle-orm/pg-core/async/db";
import type { PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Effect from "effect/Effect";
import {
  authSchema,
  DrizzlePostgresSchemaReady,
} from "@effect-coffee-shop/coffee-external-drizzle-postgres";

// Better Auth awaits queries; the application's EffectPgDatabase is not thenable.
export class AwsAuthDrizzle extends Context.Service<
  AwsAuthDrizzle,
  PgAsyncDatabase<PgQueryResultHKT>
>()("coffee-runtime-aws/AwsAuthDrizzle") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const url = yield* Config.Redacted("COFFEE_POSTGRES_URL");
      // Auth owns a small Promise-based pool, separate from the Effect app pool.
      // Both use the same database; disposal closes this pool with the runtime.
      const acquirePool = Effect.sync(
        () => new Pool({ connectionString: Redacted.value(url), max: 2 }),
      );
      const pool = yield* Effect.acquireRelease(acquirePool, (pool) =>
        Effect.promise(() => pool.end()),
      );
      return drizzle({ client: pool });
    }),
  );
}

const makeBetterAuthDatabase = Effect.fn("backend.makeBetterAuthDatabase")(function* () {
  yield* DrizzlePostgresSchemaReady;
  const db = yield* AwsAuthDrizzle;

  return drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authSchema.usersTable,
      session: authSchema.sessionsTable,
      account: authSchema.accountsTable,
      passkey: authSchema.passkeysTable,
      verification: authSchema.verificationTable,
    },
  });
});

export class AwsAuthDatabase extends Context.Service<
  AwsAuthDatabase,
  ReturnType<typeof drizzleAdapter>
>()("coffee-runtime-aws/AwsAuthDatabase") {
  static readonly layer = Layer.effect(this, makeBetterAuthDatabase());
}
