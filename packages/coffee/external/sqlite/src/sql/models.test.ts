import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  SqlCartItemModel,
  SqlMenuItemModel,
  SqlOrderItemModel,
  SqlOrderModel,
  toCartItem,
  toCoffeeOrder,
  toMenuItem,
} from "./models.ts";

const decodeSqlCartItem = Schema.decodeUnknownSync(SqlCartItemModel);
const decodeSqlMenuItem = Schema.decodeUnknownSync(SqlMenuItemModel);
const decodeSqlOrder = Schema.decodeUnknownSync(SqlOrderModel);
const decodeSqlOrderItem = Schema.decodeUnknownSync(SqlOrderItemModel);
const encodeSqlCartItem = Schema.encodeSync(SqlCartItemModel);
const encodeSqlMenuItem = Schema.encodeSync(SqlMenuItemModel);
const encodeSqlOrder = Schema.encodeSync(SqlOrderModel);
const encodeSqlOrderItem = Schema.encodeSync(SqlOrderItemModel);

describe("sqlite row models", () => {
  it("decodes menu rows from snake_case storage keys into camelCase models", () => {
    const decoded = decodeSqlMenuItem({
      id: "latte",
      name: "Latte",
      kind: "espresso",
      base_price_cents: 450,
      available_milks: '["whole","oat"]',
      available_temperatures: '["hot","iced"]',
      max_shots: 4,
    });
    const menuItem = toMenuItem(decoded);

    expect(moneyToCents(decoded.basePrice)).toBe(450);
    expect(decoded.availableMilks).toEqual(["whole", "oat"]);
    expect(decoded.availableTemperatures).toEqual(["hot", "iced"]);
    expect(decoded.maxShots).toBe(4);
    expect(moneyToCents(menuItem.basePrice)).toBe(450);
    expect(encodeSqlMenuItem(decoded)).toEqual({
      id: "latte",
      name: "Latte",
      kind: "espresso",
      base_price_cents: 450,
      available_milks: '["whole","oat"]',
      available_temperatures: '["hot","iced"]',
      max_shots: 4,
    });
  });

  it("decodes order rows from snake_case storage keys into camelCase models", () => {
    const order = decodeSqlOrder({
      id: "order-0001",
      customer_name: "Avery",
      owner_user_id: "user-avery",
      status: "pending",
      total_price_cents: 1050,
      created_at: "2026-01-01T10:00:00.000Z",
    });
    const item = decodeSqlOrderItem({
      order_id: "order-0001",
      position: 0,
      drink_id: "latte",
      drink_name: "Latte",
      size: "medium",
      milk: "whole",
      temperature: "hot",
      shots: 1,
      notes: "no foam",
      quantity: 2,
      unit_price_cents: 525,
      line_total_cents: 1050,
    });
    const coffeeOrder = toCoffeeOrder(order, [item]);

    expect(order.customerName).toBe("Avery");
    expect(order.ownerUserId).toBe("user-avery");
    expect(moneyToCents(order.totalPrice)).toBe(1050);
    expect(item.orderId).toBe("order-0001");
    expect(item.drinkId).toBe("latte");
    expect(item.drinkName).toBe("Latte");
    expect(moneyToCents(item.unitPrice)).toBe(525);
    expect(moneyToCents(item.lineTotal)).toBe(1050);
    expect(coffeeOrder.customerName).toBe("Avery");
    expect(coffeeOrder.items[0]?.drinkId).toBe("latte");
    expect(moneyToCents(coffeeOrder.totalPrice)).toBe(1050);
    expect(encodeSqlOrder(order)).toEqual({
      id: "order-0001",
      customer_name: "Avery",
      owner_user_id: "user-avery",
      status: "pending",
      total_price_cents: 1050,
      created_at: "2026-01-01T10:00:00.000Z",
    });
    expect(encodeSqlOrderItem(item)).toEqual({
      order_id: "order-0001",
      position: 0,
      drink_id: "latte",
      drink_name: "Latte",
      size: "medium",
      milk: "whole",
      temperature: "hot",
      shots: 1,
      notes: "no foam",
      quantity: 2,
      unit_price_cents: 525,
      line_total_cents: 1050,
    });
  });

  it("decodes cart rows from snake_case storage keys into camelCase models", () => {
    const decoded = decodeSqlCartItem({
      owner_user_id: "user-avery",
      id: "cart-item-0001",
      position: 0,
      drink_id: "latte",
      size: "medium",
      milk: "oat",
      temperature: "iced",
      shots: 2,
      notes: null,
      quantity: 1,
    });
    const cartItem = toCartItem(decoded);

    expect(decoded.ownerUserId).toBe("user-avery");
    expect(decoded.drinkId).toBe("latte");
    expect(cartItem.drinkId).toBe("latte");
    expect(Option.getOrThrow(cartItem.milk)).toBe("oat");
    expect(encodeSqlCartItem(decoded)).toEqual({
      owner_user_id: "user-avery",
      id: "cart-item-0001",
      position: 0,
      drink_id: "latte",
      size: "medium",
      milk: "oat",
      temperature: "iced",
      shots: 2,
      notes: null,
      quantity: 1,
    });
  });
});
