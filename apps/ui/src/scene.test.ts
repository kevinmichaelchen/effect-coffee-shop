import { test, expect as assert } from "vitest";
import { Option, DateTime, Schema } from "effect";
import { Command, click, expect, given, label, role, scene, text, type } from "foldkit/scene";
import { init } from "./init.ts";
import { update } from "./update.ts";
import { view } from "./view.ts";
import { Message } from "./message.ts";
import { Authenticate, ChangeOrder, PlaceOrder, SaveTheme } from "./commands.ts";
import { CoffeeOrder, OrdersData, ViewerData } from "./data.ts";
import { quoteOrder } from "@effect-coffee-shop/coffee-domain/Menu/OrderItem";
import { Result } from "effect";
const base = init({ page: "customer", theme: "light" }).model;
const customer = {
  ...base,
  viewer: ViewerData.Success({ data: { kind: "customer", userId: "alice", displayName: "Alice" } }),
  orders: OrdersData.Success({ data: [] }),
};
const quote = Result.getOrThrow(quoteOrder([{ drinkId: "latte", size: "medium" }]));
const order = Schema.decodeUnknownSync(Schema.toType(CoffeeOrder))({
  id: "order_01j9z3k6a0x8s5v2c4b7n1m3p6",
  customerName: "Alice",
  ownerUserId: "alice",
  ...quote,
  status: "pending",
  createdAt: DateTime.makeUnsafe("2026-10-28T10:00:00Z"),
});

test("passkey registration uses the entered display name and shows pending feedback", () => {
  const model = { ...base, viewer: ViewerData.Success({ data: { kind: "anonymous" } }) };
  scene(
    { update, view },
    given(model),
    type(label("Your name"), "Alice"),
    click(role("button", { name: "Create account" })),
    Command.expectExact(Authenticate({ action: "register", displayName: "Alice", mcp: false })),
    Command.resolve(
      Authenticate,
      Message.CompletedAuth({
        viewer: { kind: "customer", userId: "alice", displayName: "Alice" },
      }),
    ),
    expect(text("Welcome, Alice")).toExist(),
    expect(label("Drink")).toExist(),
  );
});
test("placing an order opens a receipt and closing it leaves the workspace usable", () => {
  scene(
    { update, view },
    given(customer),
    click(role("button", { name: "Place order" })),
    expect(role("button", { name: "Placing order…" })).toExist(),
    Command.expectExact(PlaceOrder({ draft: customer.draft })),
    Command.resolve(PlaceOrder, Message.PlacedOrder({ order })),
    expect(role("region", { name: "Order receipt" })).toExist(),
    click(role("button", { name: "Close receipt" })),
    expect(role("region", { name: "Order receipt" })).toBeAbsent(),
  );
});
test("staff can start brewing a pending ticket", () => {
  const staff = {
    ...customer,
    page: "staff",
    viewer: ViewerData.Success({ data: { kind: "staff", userId: "barista", displayName: "Bo" } }),
    orders: OrdersData.Success({ data: [order] }),
  } satisfies typeof base;
  scene(
    { update, view },
    given(staff),
    expect(role("button", { name: "Start brewing" })).toExist(),
    click(role("button", { name: "Start brewing" })),
    Command.expectExact(ChangeOrder({ orderId: order.id, action: "start-brewing" })),
    Command.resolve(ChangeOrder, Message.ChangedOrder({ order: { ...order, status: "brewing" } })),
  );
});
test("customer cannot see staff actions even when visiting the staff route", () => {
  scene(
    { update, view },
    given({ ...customer, page: "staff" }),
    expect(role("button", { name: "Start brewing" })).toBeAbsent(),
    expect(text("Staff access is required for this workspace.")).toExist(),
  );
});
test("switching theme is a named effect and preserves the draft", () => {
  scene(
    { update, view },
    given(customer),
    click(role("button", { name: "Dark mode" })),
    Command.expectExact(SaveTheme({ theme: "dark" })),
    Command.resolve(SaveTheme, Message.SavedTheme()),
    expect(role("button", { name: "Light mode" })).toExist(),
  );
});
test("switching to tea resets unsupported milk and shots; sign-out clears private state", () => {
  const tea = update(customer, Message.SelectedDrink({ drinkId: "tea" })).model;
  assert(tea.draft.shots).toBe("0");
  const signedOut = update(
    { ...customer, orders: OrdersData.Success({ data: [order] }), receipt: Option.some(order) },
    Message.CompletedAuth({ viewer: { kind: "anonymous" } }),
  ).model;
  assert(signedOut.orders._tag).toBe("Idle");
  assert(Option.isNone(signedOut.receipt)).toBe(true);
});
