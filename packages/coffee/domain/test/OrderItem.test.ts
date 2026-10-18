import { assert, describe, it } from "@effect/vitest";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import { DrinkNotFound } from "../src/Menu/DrinkNotFound.rejection.ts";
import { InvalidOrder } from "../src/Menu/InvalidOrder.rejection.ts";
import { priceOrderItem, quoteOrder, toDrinkSelection } from "../src/Menu/OrderItem.ts";
import type { QuantityInput, ShotCountInput } from "../src/Menu/OrderPrimitives.ts";
import { moneyToCents } from "../src/Money.ts";

const failureOf = <A, E>(result: Result.Result<A, E>) =>
  Result.match(result, { onSuccess: () => undefined, onFailure: (failure) => failure });

describe("pricing drinks", () => {
  it("fills in each menu item's defaults and prices extra shots and quantity", () => {
    const quantity: QuantityInput = 2;
    const shots: ShotCountInput = 3;
    const result = priceOrderItem({
      drinkId: "latte",
      size: "large",
      shots,
      quantity,
      notes: "  extra foam ",
    });
    assert.ok(Result.isSuccess(result));
    const item = result.success;
    assert.strictEqual(item.milk, "whole");
    assert.strictEqual(item.temperature, "hot");
    assert.strictEqual(moneyToCents(item.unitPrice), 585 + 150);
    assert.strictEqual(moneyToCents(item.lineTotal), (585 + 150) * 2);
    assert.deepStrictEqual(item.notes, Option.some("extra foam"));
    assert.deepStrictEqual(priceOrderItem(toDrinkSelection(item)), result);
  });

  it("names the menu rule a request breaks", () => {
    assert.deepStrictEqual(
      failureOf(priceOrderItem({ drinkId: "mocha", size: "small" })),
      new DrinkNotFound({ drinkId: "mocha" }),
    );
    assert.deepStrictEqual(
      failureOf(priceOrderItem({ drinkId: "latte", size: "venti" })),
      new InvalidOrder({ message: "size must be one of: small, medium, large" }),
    );
    assert.deepStrictEqual(
      failureOf(priceOrderItem({ drinkId: "espresso", size: "small", milk: "oat" })),
      new InvalidOrder({ message: 'Espresso does not support milk option "oat"' }),
    );
    assert.deepStrictEqual(
      failureOf(priceOrderItem({ drinkId: "cold-brew", size: "small", shots: 3 })),
      new InvalidOrder({ message: "Cold Brew supports at most 2 shot(s)" }),
    );
    assert.deepStrictEqual(
      failureOf(quoteOrder([])),
      new InvalidOrder({ message: "items must include at least one drink" }),
    );
  });
});
