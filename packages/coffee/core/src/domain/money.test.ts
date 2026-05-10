import { assert, describe, it } from "@effect/vitest";
import {
  addMoney,
  moneyFromCents,
  moneyToCents,
  multiplyMoney,
  scaleMoney,
  sumMoney,
} from "./money.ts";

describe("money domain", () => {
  it("keeps cents at the boundary of the Money value", () => {
    const money = moneyFromCents(450);

    assert.strictEqual(money.currency, "USD");
    assert.strictEqual(moneyToCents(money), 450);
  });

  it("adds, sums, multiplies, and scales money values", () => {
    assert.strictEqual(moneyToCents(addMoney(moneyFromCents(100), moneyFromCents(75))), 175);
    assert.strictEqual(moneyToCents(sumMoney([moneyFromCents(100), moneyFromCents(75)])), 175);
    assert.strictEqual(moneyToCents(multiplyMoney(moneyFromCents(125), 3)), 375);
    assert.strictEqual(moneyToCents(scaleMoney(moneyFromCents(450), 1.15)), 518);
  });
});
