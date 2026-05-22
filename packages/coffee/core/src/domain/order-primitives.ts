/**
 * Defines shared order primitive schemas for quantities and shot counts.
 *
 * @module
 */
import * as Schema from "effect/Schema";

export const CustomerNameSchema = Schema.Trim.check(Schema.isNonEmpty()).pipe(
  Schema.brand("CustomerName"),
);
export type CustomerName = typeof CustomerNameSchema.Type;

export const ShotCountInputSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const ShotCountSchema = ShotCountInputSchema.pipe(Schema.brand("ShotCount"));
export type ShotCount = typeof ShotCountSchema.Type;

export const QuantityInputSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
export const QuantitySchema = QuantityInputSchema.pipe(Schema.brand("Quantity"));
export type Quantity = typeof QuantitySchema.Type;
