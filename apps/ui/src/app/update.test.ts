import { Dialog } from "@foldkit/ui";
import { FeedId } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Option } from "effect";
import { Command, given, message, model, story } from "foldkit/story";
import { describe, expect, test, vi } from "vitest";
import type { Viewer } from "#features/auth/lib/viewer.ts";

// The Api clients need the Alchemy runtime; update tests only need Command identities.
vi.mock("#features/coffee-shop/api/coffee.ts", async () => {
  const { Effect } = await import("effect");
  return {
    createOrder: () => Effect.never,
    fetchMenu: Effect.never,
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
  ExpireToast,
  FetchMenu,
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
const { feedFor } = await import("#app/feed.ts");

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

const customerFeed = FeedId.make("customer:user-1");
const staffFeed = FeedId.make("staff");

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
  test("the customer paths open the customer workspace", () => {
    expect(
      ["/", "/shop", "/control-room", "/coffee-shop"].map((path) => urlToAppRoute(url(path))._tag),
    ).toEqual(["Shop", "Shop", "Shop", "Shop"]);
  });

  test("staff, MCP login and unknown paths", () => {
    expect(urlToAppRoute(url("/staff"))._tag).toBe("Staff");
    expect(urlToAppRoute(url("/login/mcp"))._tag).toBe("McpLogin");
    expect(urlToAppRoute(url("/nope"))).toEqual(AppRoute.NotFound({ path: "/nope" }));
  });
});

describe("boot", () => {
  test("every page loads the viewer, and only the customer page the menu", () => {
    const names = (pathname: string) =>
      init({ theme: "light" }, url(pathname)).commands?.map((command) => command.name);
    expect(names("/shop")).toEqual(["ApplyTheme", "FetchViewer", "FetchMenu"]);
    expect(names("/staff")).toEqual(["ApplyTheme", "FetchViewer"]);
  });
});

describe("passkey auth", () => {
  test("signing in runs the ceremony, then loads the viewer and the menu", () => {
    story(
      update,
      given(bootModel("/shop")),
      message(Message.ClickedSignIn()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.SucceededAuth({ action: "sign-in" })),
      Command.expectExact(FetchViewer),
      Command.resolve(FetchViewer, Message.SucceededFetchViewer({ viewer: customer })),
      Command.expectExact(FetchMenu),
      Command.resolve(FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })),
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

  test("signing out drops the viewer at once, so a late feed message is ignored", () => {
    story(
      update,
      given({ ...bootModel("/staff"), viewer: staff, orders: [ticket] }),
      message(Message.ClickedSignOut()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.SucceededAuth({ action: "sign-out" })),
      Command.expectExact(FetchViewer),
      model((next) => expect(next.viewer).toEqual({ kind: "anonymous" })),
      Command.resolve(FetchViewer, Message.SucceededFetchViewer({ viewer: { kind: "anonymous" } })),
      message(Message.LoadedOrders({ feedId: staffFeed, userId: "user-2", orders: [ticket] })),
      model((next) => expect(next.orders).toEqual([])),
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

  test("the live feed owns the list", () => {
    story(
      update,
      given(signedIn),
      message(Message.LoadedOrders({ feedId: customerFeed, userId: "user-1", orders: [ticket] })),
      model((next) => {
        expect(next.orders).toEqual([ticket]);
        expect(Option.isNone(next.ordersError)).toBe(true);
      }),
    );
  });
});

describe("staff queue", () => {
  const staffModel = { ...bootModel("/staff"), viewer: staff };

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
        // The reply drives the toast and the pending flag; the feed still owns the queue.
        expect(next.orders).toEqual([ticket]);
      }),
    );
  });

  test("a staff queue message from another staff account is ignored", () => {
    story(
      update,
      given({ ...staffModel, orders: [ticket] }),
      message(Message.LoadedOrders({ feedId: staffFeed, userId: "user-9", orders: [] })),
      model((next) => expect(next.orders).toEqual([ticket])),
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

describe("navigation", () => {
  test("going from the staff page to the shop loads the menu", () => {
    story(
      update,
      given({ ...bootModel("/staff"), viewer: staff }),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.expectHas(FetchMenu),
      Command.resolve(FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })),
      model((next) => expect(next.menu).toHaveLength(1)),
    );
  });

  test("switching accounts drops the previous orders", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: customer, orders: [ticket] }),
      message(
        Message.SucceededFetchViewer({
          viewer: { ...customer, userId: "user-9", displayName: "Bo" },
        }),
      ),
      Command.expectHas(FetchMenu),
      Command.resolve(FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })),
      model((next) => expect(next.orders).toEqual([])),
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

  test("navigating to the MCP login page while signed in continues to authorize", () => {
    story(
      update,
      given({ ...bootModel("/staff"), viewer: customer, menu: [latte] }),
      message(Message.ChangedUrl({ url: url("/login/mcp") })),
      Command.expectExact(LoadExternal),
      Command.resolve(LoadExternal, Message.CompletedLoadExternal()),
    );
  });

  test("a detour through an unknown page clears the orders, and the next snapshot refills them", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: customer, menu: [latte], orders: [ticket] }),
      message(Message.ChangedUrl({ url: url("/nope") })),
      model((next) => expect(next.orders).toEqual([])),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.expectNone(),
      message(Message.LoadedOrders({ feedId: customerFeed, userId: "user-1", orders: [ticket] })),
      model((next) => expect(next.orders).toEqual([ticket])),
    );
  });

  test("a feed message for another account is ignored", () => {
    story(
      update,
      given({ ...bootModel("/shop"), viewer: customer, menu: [latte], orders: [ticket] }),
      message(
        Message.LoadedOrders({
          feedId: FeedId.make("customer:user-9"),
          userId: "user-9",
          orders: [],
        }),
      ),
      message(
        Message.FailedOrders({
          feedId: staffFeed,
          userId: "user-2",
          message: "Live updates disconnected.",
        }),
      ),
      model((next) => {
        expect(next.orders).toEqual([ticket]);
        expect(Option.isNone(next.ordersError)).toBe(true);
      }),
    );
  });
});

describe("feeds", () => {
  test("only the page's own feed is shown to its own viewer", () => {
    const feedOf = (pathname: string, viewer: Viewer) =>
      Option.getOrElse(feedFor({ ...bootModel(pathname), viewer }), () => "none");
    expect([
      feedOf("/shop", customer),
      feedOf("/coffee-shop", customer),
      feedOf("/staff", staff),
      feedOf("/staff", customer),
      feedOf("/login/mcp", customer),
      feedOf("/nope", customer),
      feedOf("/shop", { kind: "anonymous" }),
    ]).toEqual(["customer:user-1", "customer:user-1", "staff", "none", "none", "none", "none"]);
  });
});
