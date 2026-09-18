import { assert, describe, it } from "@effect/vitest";
import * as Eq from "effect/Equal";
import * as Schema from "effect/Schema";
import {
  addMoney,
  moneyFromCents,
  moneyToCents,
  multiplyMoney,
  MinorUnitsInput,
  scaleMoney,
  sumMoney,
} from "./money.ts";

describe("money domain", () => {
  const cents = MinorUnitsInput.check(Schema.isLessThanOrEqualTo(1_000_000));

  it.prop("round-trips cents without losing precision", { cents }, ({ cents }) => {
    assert.strictEqual(moneyToCents(moneyFromCents(cents)), cents);
  });

  it.prop("money addition is associative", { a: cents, b: cents, c: cents }, ({ a, b, c }) => {
    const left = addMoney(addMoney(moneyFromCents(a), moneyFromCents(b)), moneyFromCents(c));
    const right = addMoney(moneyFromCents(a), addMoney(moneyFromCents(b), moneyFromCents(c)));
    assert.ok(Eq.equals(left, right));
    assert.strictEqual(moneyToCents(left), a + b + c);
  });

  it("keeps cents at the boundary of the Money value", () => {
    const money = moneyFromCents(450);

    assert.strictEqual(money.currency, "USD");
    assert.strictEqual(moneyToCents(money), 450);
  });

  it("uses Effect equality for value comparisons", () => {
    assert.ok(Eq.equals(moneyFromCents(450), moneyFromCents(450)));
    assert.strictEqual(Eq.equals(moneyFromCents(450), moneyFromCents(451)), false);
  });

  it("adds, sums, multiplies, and scales money values", () => {
    assert.strictEqual(moneyToCents(addMoney(moneyFromCents(100), moneyFromCents(75))), 175);
    assert.strictEqual(moneyToCents(sumMoney([moneyFromCents(100), moneyFromCents(75)])), 175);
    assert.strictEqual(moneyToCents(multiplyMoney(moneyFromCents(125), 3)), 375);
    assert.strictEqual(moneyToCents(scaleMoney(moneyFromCents(450), 1.15)), 518);
  });
});
