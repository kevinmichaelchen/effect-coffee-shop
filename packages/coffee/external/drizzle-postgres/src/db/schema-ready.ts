/**
 * Tracks whether the Postgres schema has been migrated for the runtime.
 *
 * @module
 */
import * as Context from "effect/Context";

export class DrizzlePostgresSchemaReady extends Context.Service<
  DrizzlePostgresSchemaReady,
  {
    readonly ready: true;
  }
>()("effect-coffee-shop/external/drizzle-postgres/DrizzlePostgresSchemaReady") {}
