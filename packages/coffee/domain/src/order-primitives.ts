/**
 * Defines shared order primitive schemas for quantities and shot counts.
 *
 * @module
 */
import * as Schema from "effect/Schema";

export const CustomerName = Schema.Trim.check(Schema.isNonEmpty()).pipe(
  Schema.brand("CustomerName"),
);
export type CustomerName = typeof CustomerName.Type;

export const ShotCountInput = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const ShotCount = ShotCountInput.pipe(Schema.brand("ShotCount"));
export type ShotCount = typeof ShotCount.Type;

export const QuantityInput = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
export const Quantity = QuantityInput.pipe(Schema.brand("Quantity"));
export type Quantity = typeof Quantity.Type;

export type ShotCountInput = typeof ShotCountInput.Type;

export type QuantityInput = typeof QuantityInput.Type;
