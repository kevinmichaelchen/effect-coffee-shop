/**
 * Defines exact cent-based money values and arithmetic helpers.
 *
 * @module
 */
import * as Eq from "effect/Equal";
import * as Hash from "effect/Hash";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

export const CurrencySchema = Schema.Literal("USD");
export type Currency = typeof CurrencySchema.Type;
export const MinorUnitsInputSchema = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const MinorUnitsSchema = MinorUnitsInputSchema.pipe(Schema.brand("MinorUnits"));
export type MinorUnits = typeof MinorUnitsSchema.Type;

export class Money
  extends Schema.Class<Money>("Money")({
    currency: CurrencySchema,
    minorUnits: MinorUnitsSchema,
  })
  implements Eq.Equal
{
  [Eq.symbol](that: Eq.Equal): boolean {
    return (
      Schema.is(Money)(that) &&
      this.currency === that.currency &&
      this.minorUnits === that.minorUnits
    );
  }

  [Hash.symbol](): number {
    return Hash.combine(Hash.hash(this.currency), Hash.number(this.minorUnits));
  }
}

export const MoneySchema = Money;

export const MoneyFromCentsSchema = MinorUnitsInputSchema.pipe(
  Schema.decodeTo(
    MoneySchema,
    SchemaTransformation.transform({
      decode: (minorUnits) => ({
        currency: "USD",
        minorUnits,
      }),
      encode: (money) => money.minorUnits,
    }),
  ),
).annotate({ identifier: "MoneyFromCents" });

const minorUnitsFromNumber = Schema.decodeUnknownSync(MinorUnitsSchema);

export const zeroMoney: Money = new Money({
  currency: "USD",
  minorUnits: minorUnitsFromNumber(0),
});

export const moneyFromCents = (cents: number): Money =>
  Schema.decodeUnknownSync(MoneyFromCentsSchema)(cents);

export const moneyToCents = (money: Money): number => money.minorUnits;

export const addMoney = (left: Money, right: Money): Money =>
  moneyFromCents(left.minorUnits + right.minorUnits);

export const sumMoney = (values: readonly Money[]): Money => values.reduce(addMoney, zeroMoney);

export const multiplyMoney = (money: Money, quantity: number): Money =>
  moneyFromCents(money.minorUnits * quantity);

export const scaleMoney = (money: Money, multiplier: number): Money =>
  moneyFromCents(Math.round(money.minorUnits * multiplier));
