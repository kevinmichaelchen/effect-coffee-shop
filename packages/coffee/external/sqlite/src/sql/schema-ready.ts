/**
 * Tracks whether the SQLite schema has been prepared for the runtime.
 *
 * @module
 */
import * as Context from "effect/Context";

export class SqlCoffeeSchemaReady extends Context.Service<
  SqlCoffeeSchemaReady,
  {
    readonly ready: true;
  }
>()("effect-coffee-shop/external/sql/SqlCoffeeSchemaReady") {}
