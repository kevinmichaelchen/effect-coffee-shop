import { Dialog } from "@foldkit/ui";
import { Option } from "effect";
import { Command, given, message, model, story } from "foldkit/story";
import { describe, expect, test, vi } from "vitest";

// The Api clients need the Alchemy runtime; update tests only need Command identities.
vi.mock("#features/coffee-shop/api/coffee.ts", async () => {
  const { Effect } = await import("effect");
  return {
    createOrder: () => Effect.never,
    fetchCustomerOrders: () => Effect.never,
    fetchMenu: Effect.never,
    fetchStaffQueue: Effect.never,
    updateOrderStatus: () => Effect.never,
  };
});
vi.mock("#features/auth/auth-client.ts", () => ({
  authClient: {
    register: async () => ({ ok: true, message: "" }),
    signIn: async () => ({ ok: true, message: "" }),
    signOut: async () => ({ ok: true, message: "" }),
  },
}));

const {
  ApplyTheme,
  CopyUserId,
  ExpireToast,
  FetchCustomerOrders,
  FetchMenu,
  FetchStaffQueue,
  FetchViewer,
  LoadExternal,
  PlaceOrder,
  RunOrderAction,
  RunPasskeyAuth,
} = await import("#app/command.ts");
const { init } = await import("#app/main.ts");
const { Message } = await import("#app/message.ts");
const { update } = await import("#app/update.ts");
const { AppRoute, urlToAppRoute } = await import("#app/route.ts");

const url = (pathname: string) => ({
  protocol: "https:",
  host: "coffee.test",
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
});

const bootModel = (pathname: string) => init({ theme: "light" }, url(pathname)).model;

const customer = { kind: "customer", displayName: "Ada", userId: "user-1" } as const;
const staff = { kind: "staff", displayName: "Sam", userId: "user-2" } as const;

const latte = {
  id: "latte",
  name: "Latte",
  kind: "espresso",
  basePriceCents: 450,
  availableMilks: ["whole", "oat"],
  availableTemperatures: ["hot", "iced"],
  maxShots: 3,
} as const;

const ticket = {
  id: "ticket-1",
  customerName: "Ada",
  ownerUserId: "user-1",
  items: [],
  status: "pending",
  totalPriceCents: 450,
  createdAt: "2026-10-27T12:00:00.000Z",
} as const;

describe("routing", () => {
  test.each(["/", "/shop", "/control-room", "/coffee-shop"])(
    "%s opens the customer workspace",
    (path) => {
      expect(urlToAppRoute(url(path))._tag).toBe("Shop");
    },
  );

  test("staff, MCP login and unknown paths", () => {
    expect(urlToAppRoute(url("/staff"))._tag).toBe("Staff");
    expect(urlToAppRoute(url("/login/mcp"))._tag).toBe("McpLogin");
    expect(urlToAppRoute(url("/nope"))).toEqual(AppRoute.NotFound({ path: "/nope" }));
  });
});

describe("boot", () => {
  test("the customer page loads the viewer and the menu, and applies the theme", () => {
    const { commands } = init({ theme: "dark" }, url("/shop"));
    expect(commands?.map((command) => command.name)).toEqual([
      "ApplyTheme",
      "FetchViewer",
      "FetchMenu",
    ]);
  });

  test("the staff page does not need the menu", () => {
    const { commands } = init({ theme: "light" }, url("/staff"));
    expect(commands?.map((command) => command.name)).toEqual(["ApplyTheme", "FetchViewer"]);
  });
});

describe("passkey auth", () => {
  test("creating an account needs a name", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedCreateAccount()),
      model((next) => {
        expect(Option.isSome(next.authError)).toBe(true);
        expect(Option.isNone(next.pendingAuth)).toBe(true);
      }),
      Command.expectNone(),
    );
  });

  test("signing in runs the ceremony, then refreshes the viewer and the orders", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedSignIn()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.SucceededAuth({ action: "sign-in" })),
      Command.expectExact(FetchViewer),
      Command.resolve(FetchViewer, Message.SucceededFetchViewer({ viewer: customer })),
      Command.expectExact(FetchCustomerOrders),
      Command.resolve(
        FetchCustomerOrders,
        Message.SucceededFetchOrders({ source: "customer", userId: "user-1", orders: [] }),
      ),
      model((next) => {
        expect(next.viewer).toEqual(customer);
        expect(Option.isNone(next.pendingAuth)).toBe(true);
      }),
    );
  });

  test("a failed ceremony shows the message and unlocks the buttons", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedSignIn()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.FailedAuth({ message: "Cancelled" })),
      model((next) => {
        expect(next.authError).toEqual(Option.some("Cancelled"));
        expect(Option.isNone(next.pendingAuth)).toBe(true);
      }),
    );
  });

  test("signing in on the MCP login page continues to the OAuth authorize step", () => {
    story(
      update,
      given(bootModel("/login/mcp")),
      message(Message.ClickedSignIn()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.SucceededAuth({ action: "sign-in" })),
      Command.expectExact(LoadExternal),
      Command.resolve(LoadExternal, Message.CompletedLoadExternal()),
    );
  });
});

describe("customer orders", () => {
  const signedIn = { ...bootModel("/shop"), viewer: customer, menu: [latte] };

  test("sending an order places it, then shows the receipt and a toast", () => {
    story(
      update,
      given(signedIn),
      message(Message.ClickedSendOrder()),
      Command.expectExact(PlaceOrder),
      model((next) => expect(next.isPlacingOrder).toBe(true)),
      Command.resolve(PlaceOrder, Message.SucceededPlaceOrder({ order: ticket })),
      Command.resolveAll(
        [ExpireToast, Message.ExpiredToast({ id: "toast-0" })],
        [Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()],
      ),
      model((next) => {
        expect(next.isPlacingOrder).toBe(false);
        expect(next.receipt).toEqual(Option.some(ticket));
        expect(next.orders).toEqual([ticket]);
        // The toast timer fired in this story, so the toast is gone again.
        expect(next.toasts).toHaveLength(0);
      }),
    );
  });

  test("a second click while sending is ignored", () => {
    story(
      update,
      given({ ...signedIn, isPlacingOrder: true }),
      message(Message.ClickedSendOrder()),
      Command.expectNone(),
    );
  });

  test("switching to tea clamps shots and milk to what the drink allows", () => {
    const tea = {
      ...latte,
      id: "earl-grey",
      name: "Earl Grey",
      kind: "tea",
      availableMilks: ["none"],
      maxShots: 0,
    } as const;
    story(
      update,
      given({ ...signedIn, menu: [latte, tea] }),
      message(Message.ChangedShots({ value: "2" })),
      message(Message.ClickedSelectDrink({ drinkId: "earl-grey" })),
      model((next) => {
        expect(Option.map(next.draft, (draft) => [draft.shots, draft.milk])).toEqual(
          Option.some([0, "none"]),
        );
      }),
    );
  });

  test("orders that arrive after sign-out are dropped", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(
        Message.SucceededFetchOrders({ source: "customer", userId: "user-1", orders: [ticket] }),
      ),
      model((next) => expect(next.orders).toEqual([])),
    );
  });
});

describe("staff queue", () => {
  const staffModel = { ...bootModel("/staff"), viewer: staff };

  test("polling refreshes the queue while a staff member is on the page", () => {
    story(
      update,
      given(staffModel),
      message(Message.TickedOrdersRefresh()),
      Command.expectExact(FetchStaffQueue),
      Command.resolve(
        FetchStaffQueue,
        Message.SucceededFetchOrders({ source: "staff", userId: "user-2", orders: [ticket] }),
      ),
      model((next) => expect(next.orders).toEqual([ticket])),
    );
  });

  test("a customer account does not poll the staff queue", () => {
    story(
      update,
      given({ ...staffModel, viewer: customer }),
      message(Message.TickedOrdersRefresh()),
      Command.expectNone(),
    );
  });

  test("an order action marks the order pending, then shows the reply right away", () => {
    story(
      update,
      given({ ...staffModel, orders: [ticket] }),
      message(Message.ClickedOrderAction({ orderId: "ticket-1", action: "start-brewing" })),
      Command.expectExact(RunOrderAction),
      model((next) => expect(next.pendingOrderId).toEqual(Option.some("ticket-1"))),
      Command.resolve(
        RunOrderAction,
        Message.SucceededOrderAction({ order: { ...ticket, status: "brewing" } }),
      ),
      Command.resolve(ExpireToast, Message.ExpiredToast({ id: "toast-0" })),
      model((next) => {
        expect(next.pendingOrderId).toEqual(Option.none());
        expect(next.orders.map((order) => order.status)).toEqual(["brewing"]);
      }),
    );
  });
});

describe("theme", () => {
  test("toggling persists the new preference", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedToggleTheme()),
      Command.expectExact(ApplyTheme),
      Command.resolve(ApplyTheme, Message.CompletedApplyTheme()),
      model((next) => expect(next.theme).toBe("dark")),
    );
  });
});

describe("regressions found in review", () => {
  const staffModel = { ...bootModel("/staff"), viewer: staff };
  const staffReply = Message.SucceededFetchOrders({
    source: "staff",
    userId: "user-2",
    orders: [ticket],
  });

  test("going from the staff page to the shop loads the menu", () => {
    story(
      update,
      given(staffModel),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.expectHas(FetchMenu),
      Command.resolveAll(
        [
          FetchCustomerOrders,
          Message.SucceededFetchOrders({ source: "customer", userId: "user-2", orders: [] }),
        ],
        [FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })],
      ),
      model((next) => expect(next.menu).toHaveLength(1)),
    );
  });

  test("a staff queue reply that lands after navigating to the shop is dropped", () => {
    story(
      update,
      given({ ...staffModel, menu: [latte] }),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.resolveAll(
        [
          FetchCustomerOrders,
          Message.SucceededFetchOrders({ source: "customer", userId: "user-2", orders: [] }),
        ],
        [FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })],
      ),
      message(staffReply),
      model((next) => expect(next.orders).toEqual([])),
    );
  });

  test("a reply for the previous account is dropped after switching accounts", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: { ...customer, userId: "user-9" } }),
      message(
        Message.SucceededFetchOrders({ source: "customer", userId: "user-1", orders: [ticket] }),
      ),
      model((next) => expect(next.orders).toEqual([])),
    );
  });

  test("a poll tick does not start a second fetch while one is in flight", () => {
    story(
      update,
      given({ ...staffModel, isRefreshingOrders: true }),
      message(Message.TickedOrdersRefresh()),
      Command.expectNone(),
    );
  });

  test("a second order action is ignored while one is pending", () => {
    story(
      update,
      given({ ...staffModel, orders: [ticket], pendingOrderId: Option.some("ticket-1") }),
      message(Message.ClickedOrderAction({ orderId: "ticket-2", action: "cancel" })),
      Command.expectNone(),
    );
  });

  test("a receipt that arrives after leaving the shop does not touch the staff page", () => {
    story(
      update,
      given({ ...staffModel, isPlacingOrder: true }),
      message(Message.SucceededPlaceOrder({ order: ticket })),
      model((next) => {
        expect(next.isPlacingOrder).toBe(false);
        expect(next.orders).toEqual([]);
        expect(Option.isNone(next.receipt)).toBe(true);
      }),
      Command.expectNone(),
    );
  });

  test("a failed order action also shows inside the open drawer", () => {
    story(
      update,
      given({
        ...staffModel,
        selectedOrderId: Option.some("ticket-1"),
        pendingOrderId: Option.some("ticket-1"),
      }),
      message(Message.FailedOrderAction({ message: "Only coffee-shop staff can do that." })),
      Command.resolve(ExpireToast, Message.ExpiredToast({ id: "toast-0" })),
      model((next) =>
        expect(next.detailsError).toEqual(Option.some("Only coffee-shop staff can do that.")),
      ),
    );
  });

  test("signed-in visitors on the MCP login page continue to authorize", () => {
    story(
      update,
      given(bootModel("/login/mcp")),
      message(Message.SucceededFetchViewer({ viewer: customer })),
      Command.expectExact(LoadExternal),
      Command.resolve(LoadExternal, Message.CompletedLoadExternal()),
    );
  });

  test("copying the user id reports success and failure", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: customer }),
      message(Message.ClickedCopyUserId()),
      Command.expectExact(CopyUserId),
      Command.resolve(CopyUserId, Message.SucceededCopyUserId()),
      model((next) => expect(next.copyState).toBe("copied")),
    );
  });

  test("a failure for another ticket does not show inside this ticket's drawer", () => {
    story(
      update,
      given({
        ...staffModel,
        selectedOrderId: Option.some("ticket-1"),
        pendingOrderId: Option.some("ticket-2"),
      }),
      message(Message.FailedOrderAction({ message: "Nope" })),
      Command.resolve(ExpireToast, Message.ExpiredToast({ id: "toast-0" })),
      model((next) => expect(Option.isNone(next.detailsError)).toBe(true)),
    );
  });

  test("opening another ticket clears the previous drawer error", () => {
    story(
      update,
      given({ ...staffModel, orders: [ticket], detailsError: Option.some("Old failure") }),
      message(Message.ClickedInspectOrder({ orderId: "ticket-1" })),
      Command.expectHas(Dialog.ShowDialog),
      Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
      model((next) => expect(Option.isNone(next.detailsError)).toBe(true)),
    );
  });

  test("an action started before navigating away still blocks a second one", () => {
    story(
      update,
      given({ ...staffModel, pendingOrderId: Option.some("ticket-1") }),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.resolveAll(
        [
          FetchCustomerOrders,
          Message.SucceededFetchOrders({ source: "customer", userId: "user-2", orders: [] }),
        ],
        [FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })],
      ),
      message(Message.ChangedUrl({ url: url("/staff") })),
      Command.resolve(
        FetchStaffQueue,
        Message.SucceededFetchOrders({ source: "staff", userId: "user-2", orders: [] }),
      ),
      message(Message.ClickedOrderAction({ orderId: "ticket-2", action: "cancel" })),
      Command.expectNone(),
    );
  });

  test("a failed menu load is retried on the next poll tick", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: customer, menuError: Option.some("boom") }),
      message(Message.TickedOrdersRefresh()),
      Command.resolveAll(
        [
          FetchCustomerOrders,
          Message.SucceededFetchOrders({ source: "customer", userId: "user-1", orders: [] }),
        ],
        [FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })],
      ),
      model((next) => expect(next.menu).toHaveLength(1)),
    );
  });

  test("navigating to the MCP login page while signed in continues to authorize", () => {
    story(
      update,
      given({ ...bootModel("/staff"), viewer: customer }),
      message(Message.ChangedUrl({ url: url("/login/mcp") })),
      Command.resolveAll(
        [
          FetchCustomerOrders,
          Message.SucceededFetchOrders({ source: "customer", userId: "user-1", orders: [] }),
        ],
        [FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })],
        [LoadExternal, Message.CompletedLoadExternal()],
      ),
    );
  });
});
