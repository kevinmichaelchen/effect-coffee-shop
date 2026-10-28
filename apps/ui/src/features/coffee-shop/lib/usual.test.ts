import { Option } from "effect";
import { describe, expect, test } from "vitest";
import type { MenuItem, OrderTicket } from "./coffee-schemas.ts";
import { usualDraft } from "./usual.ts";

const latte: MenuItem = {
  id: "latte",
  name: "Latte",
  kind: "espresso",
  basePriceCents: 450,
  availableMilks: ["whole", "oat"],
  availableTemperatures: ["hot", "iced"],
  maxShots: 3,
};

const chai: MenuItem = {
  id: "chai",
  name: "Chai",
  kind: "tea",
  basePriceCents: 400,
  availableMilks: ["whole", "oat"],
  availableTemperatures: ["hot", "iced"],
  maxShots: 0,
};

const menu = [latte, chai];

type OrderItem = OrderTicket["items"][number];

const line = (drinkId: string, quantity = 1): OrderItem => ({
  drinkId,
  drinkName: drinkId === "latte" ? "Latte" : "Chai",
  size: "medium",
  milk: "whole",
  temperature: "hot",
  shots: 1,
  quantity,
  unitPriceCents: 450,
  lineTotalCents: 450 * quantity,
});

const ticket = (
  id: string,
  createdAt: string,
  items: OrderTicket["items"],
  status: OrderTicket["status"] = "picked-up",
): OrderTicket => ({
  id,
  customerName: "Ada",
  ownerUserId: "user-1",
  items,
  status,
  totalPriceCents: items.reduce((total, item) => total + item.lineTotalCents, 0),
  createdAt,
});

const usualDrink = (orders: readonly OrderTicket[], items: readonly MenuItem[] = menu) =>
  Option.getOrUndefined(Option.map(usualDraft(orders, items), (draft) => draft.drinkId));

describe("usualDraft", () => {
  test("a drink ordered once is not yet a usual", () => {
    expect(usualDrink([ticket("ticket-1", "2026-10-27T12:00:00.000Z", [line("latte")])])).toBe(
      undefined,
    );
  });

  test("quantity counts, not just tickets", () => {
    const orders = [
      ticket("ticket-1", "2026-10-27T10:00:00.000Z", [line("chai", 3)]),
      ticket("ticket-2", "2026-10-27T12:00:00.000Z", [line("latte", 1)]),
    ];

    expect(usualDrink(orders)).toBe("chai");
  });

  test("cancelled tickets are not habits", () => {
    const orders = [
      ticket("ticket-1", "2026-10-27T09:00:00.000Z", [line("latte", 5)], "cancelled"),
      ticket("ticket-2", "2026-10-27T10:00:00.000Z", [line("chai")]),
      ticket("ticket-3", "2026-10-27T11:00:00.000Z", [line("chai")]),
    ];

    expect(usualDrink(orders)).toBe("chai");
  });

  test("cancelled tickets cannot reach the threshold on their own", () => {
    const orders = [
      ticket("ticket-1", "2026-10-27T09:00:00.000Z", [line("latte", 4)], "cancelled"),
    ];

    expect(usualDrink(orders)).toBe(undefined);
  });

  test("ties go to the drink ordered most recently", () => {
    const orders = [
      ticket("ticket-1", "2026-10-25T09:00:00.000Z", [line("chai")]),
      ticket("ticket-2", "2026-10-25T10:00:00.000Z", [line("chai")]),
      ticket("ticket-3", "2026-10-26T09:00:00.000Z", [line("latte")]),
      ticket("ticket-4", "2026-10-27T09:00:00.000Z", [line("latte")]),
    ];

    expect(usualDrink(orders)).toBe("latte");
  });

  test("a usual that left the menu is no usual at all", () => {
    const orders = [
      ticket("ticket-1", "2026-10-26T09:00:00.000Z", [line("latte")]),
      ticket("ticket-2", "2026-10-27T09:00:00.000Z", [line("latte")]),
    ];

    expect(usualDrink(orders, [chai])).toBe(undefined);
  });
});
