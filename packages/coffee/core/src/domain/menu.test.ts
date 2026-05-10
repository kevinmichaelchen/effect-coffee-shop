import { assert, describe, it } from "@effect/vitest";
import {
  calculatePrice,
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  menuItems,
} from "./menu.ts";
import { moneyToCents } from "./money.ts";

const getMenuItem = (id: string) => {
  const item = menuItems.find((candidate) => candidate.id === id);
  if (item === undefined) {
    throw new Error(`Missing menu item for test: ${id}`);
  }
  return item;
};

const latte = getMenuItem("latte");
const coldBrew = getMenuItem("cold-brew");
const tea = getMenuItem("tea");

describe("menu domain", () => {
  it("derives defaults from each menu item's capabilities", () => {
    assert.strictEqual(defaultMilkFor(latte), "whole");
    assert.strictEqual(defaultMilkFor(tea), "none");
    assert.strictEqual(defaultTemperatureFor(coldBrew), "iced");
    assert.strictEqual(defaultTemperatureFor(tea), "hot");
    assert.strictEqual(defaultShotsFor(latte), 1);
    assert.strictEqual(defaultShotsFor(tea), 0);
  });

  it("calculates prices from size multipliers and extra shots", () => {
    assert.strictEqual(moneyToCents(calculatePrice(latte, "medium", 1)), 518);
    assert.strictEqual(moneyToCents(calculatePrice(latte, "medium", 3)), 668);
    assert.strictEqual(moneyToCents(calculatePrice(coldBrew, "large", 2)), 595);
  });
});
