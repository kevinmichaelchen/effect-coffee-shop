import { AlreadyPlaced } from "@effect-coffee-shop/coffee-domain/Order/PlaceOrder.command";
import { DrinkNotFound } from "@effect-coffee-shop/coffee-domain/Menu/DrinkNotFound.rejection";
import { InvalidOrder } from "@effect-coffee-shop/coffee-domain/Menu/InvalidOrder.rejection";
import { InvalidStatusTransition } from "@effect-coffee-shop/coffee-domain/Order/InvalidStatusTransition.rejection";
import { OrderNotFound } from "@effect-coffee-shop/coffee-domain/Order/OrderNotFound.rejection";
import { StaffOnly } from "@effect-coffee-shop/coffee-domain/StaffOnly.rejection";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import { describe, expect, test } from "vitest";
import { describeOrderFailure, isRetryable, type OrderFailure } from "./order-failures.ts";

type OrderRejection = Extract<OrderFailure, { readonly _tag: "Rejected" }>["rejection"];

const orderId = OrderId.make("order_01j9z3k6a0x8s5v2c4b7n1m3p6");

const denied: OrderFailure = { _tag: "Denied", error: new Unauthorized() };
const rejected = (rejection: OrderRejection): OrderFailure => ({ _tag: "Rejected", rejection });

describe("order failures", () => {
  test("each rejection says what the domain refused", () => {
    expect(
      [
        rejected(new AlreadyPlaced({ orderId })),
        rejected(new DrinkNotFound({ drinkId: "espresso" })),
        rejected(new InvalidOrder({ message: "Tea drinks do not support extra shots" })),
        rejected(new InvalidStatusTransition({ orderId, from: "ready", to: "brewing" })),
        rejected(new OrderNotFound({ orderId })),
        rejected(new StaffOnly()),
      ].map(describeOrderFailure),
    ).toEqual([
      "This order was already placed.",
      '"espresso" is not on the menu.',
      "Tea drinks do not support extra shots",
      "An order that is Ready cannot move to Brewing.",
      `Order ${orderId} was not found.`,
      "Only coffee-shop staff can do that.",
    ]);
  });

  test("a denial asks for a sign-in, an unknown outcome asks to retry", () => {
    expect([describeOrderFailure(denied), describeOrderFailure({ _tag: "Unknown" })]).toEqual([
      "Sign in to place and view orders.",
      "Unable to reach the coffee shop. Check your connection and try again.",
    ]);
  });

  test("only an unknown outcome may be retried with the same command id", () => {
    expect([
      isRetryable({ _tag: "Unknown" }),
      isRetryable(denied),
      isRetryable(rejected(new StaffOnly())),
    ]).toEqual([true, false, false]);
  });
});
