/**
 * Defines exact cent-based money values and arithmetic helpers.
 *
 * @module
 */
import * as Eq from "effect/Equal";
import * as Hash from "effect/Hash";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

export const Currency = Schema.Literal("USD");
export type Currency = typeof Currency.Type;
export const MinorUnitsInput = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));
export const MinorUnits = MinorUnitsInput.pipe(Schema.brand("MinorUnits"));
export type MinorUnits = typeof MinorUnits.Type;

export class Money
  extends Schema.Class<Money>("Money")({
    currency: Currency,
    minorUnits: MinorUnits,
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

export const MoneyFromCents = MinorUnitsInput.pipe(
  Schema.decodeTo(
    Money,
    SchemaTransformation.transform({
      decode: (minorUnits) => ({
        currency: "USD",
        minorUnits,
      }),
      encode: (money) => money.minorUnits,
    }),
  ),
).annotate({ identifier: "MoneyFromCents" });

const minorUnitsFromNumber = Schema.decodeUnknownSync(MinorUnits);

export const zeroMoney: Money = new Money({
  currency: "USD",
  minorUnits: minorUnitsFromNumber(0),
});

export const moneyFromCents = (cents: number): Money =>
  Schema.decodeUnknownSync(MoneyFromCents)(cents);

export const moneyToCents = (money: Money): number => money.minorUnits;

export const addMoney = (left: Money, right: Money): Money =>
  moneyFromCents(left.minorUnits + right.minorUnits);

export const sumMoney = (values: readonly Money[]): Money => values.reduce(addMoney, zeroMoney);

export const multiplyMoney = (money: Money, quantity: number): Money =>
  moneyFromCents(money.minorUnits * quantity);

export const scaleMoney = (money: Money, multiplier: number): Money =>
  moneyFromCents(Math.round(money.minorUnits * multiplier));

export type MinorUnitsInput = typeof MinorUnitsInput.Type;
