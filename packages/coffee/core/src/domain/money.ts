import * as Schema from "effect/Schema";

export const CurrencySchema = Schema.Literal("USD");
export type Currency = typeof CurrencySchema.Type;

export const MoneySchema = Schema.Struct({
  currency: CurrencySchema,
  minorUnits: Schema.Int,
}).annotate({ identifier: "Money" });
export type Money = typeof MoneySchema.Type;

export const zeroMoney: Money = {
  currency: "USD",
  minorUnits: 0,
};

export const moneyFromCents = (cents: number): Money => ({
  currency: "USD",
  minorUnits: cents,
});

export const moneyToCents = (money: Money): number => money.minorUnits;

export const addMoney = (left: Money, right: Money): Money =>
  moneyFromCents(left.minorUnits + right.minorUnits);

export const sumMoney = (values: readonly Money[]): Money => values.reduce(addMoney, zeroMoney);

export const multiplyMoney = (money: Money, quantity: number): Money =>
  moneyFromCents(money.minorUnits * quantity);

export const scaleMoney = (money: Money, multiplier: number): Money =>
  moneyFromCents(Math.round(money.minorUnits * multiplier));
