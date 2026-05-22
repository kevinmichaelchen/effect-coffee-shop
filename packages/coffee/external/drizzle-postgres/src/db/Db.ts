/**
 * Defines the Drizzle/Postgres database service and live client layer.
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

export class CoffeeDb extends Context.Service<CoffeeDb>()(
  "effect-coffee-shop/external/drizzle-postgres/CoffeeDb",
  {
    make: PgDrizzle.make(),
  },
) {
  static readonly layer = Layer.effect(this, this.make).pipe(
    Layer.provide(PgDrizzle.DefaultServices),
    Layer.provide(PgCoffeeClientLive),
  );
}
