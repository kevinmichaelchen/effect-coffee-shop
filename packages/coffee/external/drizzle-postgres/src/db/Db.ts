/**
 * Defines the Drizzle/Postgres database service and live client layer.
 *
 * The service shape is the driver-agnostic `EffectPgDatabase` (no `$client`
 * pin), so alternative Postgres drivers — e.g. PGlite via
 * `drizzle-orm/effect-pglite` in tests — can satisfy the same service.
 *
 * @module
 */
import { PgClient } from "@effect/sql-pg";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Layer from "effect/Layer";
import * as PgDrizzle from "drizzle-orm/effect-postgres";

export const PgCoffeeClientLive = PgClient.layerConfig({
  url: Config.redacted("COFFEE_POSTGRES_URL"),
});

export class CoffeeDb extends Context.Service<CoffeeDb, PgDrizzle.EffectPgDatabase>()(
  "effect-coffee-shop/external/drizzle-postgres/CoffeeDb",
) {
  static readonly layer = Layer.effect(this, PgDrizzle.make()).pipe(
    Layer.provide(PgDrizzle.DefaultServices),
    Layer.provide(PgCoffeeClientLive),
  );
}
