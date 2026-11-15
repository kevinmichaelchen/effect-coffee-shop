import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { Unauthorized } from "@effect-coffee-shop/coffee-domain/Session.middleware";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Dialog, Toast as UiToast } from "@foldkit/ui";
import { DateTime, Option, Schema } from "effect";
import * as AsyncData from "foldkit/asyncData";
import { Command, given, message, model, story } from "foldkit/story";
import { describe, expect, test, vi } from "vitest";
import type { Feed } from "#app/feed.ts";
import type { Viewer } from "#features/auth/lib/viewer.ts";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { toPlaceOrderRequest } from "#features/coffee-shop/lib/coffee.ts";
import { composerFor } from "#app/draft.ts";

vi.mock("#features/auth/auth-client.ts", () => ({
  authClient: {
    register: async () => ({ ok: true, message: "" }),
    signIn: async () => ({ ok: true, message: "" }),
    signOut: async () => ({ ok: true, message: "" }),
  },
}));

const { ApplyTheme, FetchMenu, FetchViewer, LoadExternal, RunPasskeyAuth, StartOrder } =
  await import("#app/command.ts");
const { init } = await import("#app/main.ts");
const { MenuData, OrdersData, ViewerData } = await import("#app/model.ts");
const { Message } = await import("#app/message.ts");
const { update } = await import("#app/update.ts");
const { AppRoute, urlToAppRoute } = await import("#app/route.ts");
const { feedFor } = await import("#app/feed.ts");

/** The domain commands the app sends, as the Api's own client builds them. */
const CustomerDomain = DomainFoldkit.make(CustomerApi);
const StaffDomain = DomainFoldkit.make(StaffApi);

const url = (pathname: string) => ({
  protocol: "https:",
  host: "coffee.test",
  port: Option.none(),
  pathname,
  search: Option.none(),
  hash: Option.none(),
});

/** A page load's command-id session, so a test knows the ids the app will send. */
const flags = { theme: "light", commandIds: { session: "test", sent: 0 } } as const;

const bootModel = (pathname: string) => init(flags, url(pathname)).model;

const customer = { kind: "customer", displayName: "Ada", userId: "user-1" } as const;
const staff = { kind: "staff", displayName: "Sam", userId: "user-2" } as const;

const customerFeed: Feed = { _tag: "CustomerOrders", customerId: "user-1" };
const staffFeed: Feed = { _tag: "OrderQueue" };

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
  id: "order_01j9z3k6a0x8s5v2c4b7n1m3p6",
  customerName: "Ada",
  ownerUserId: "user-1",
  items: [],
  status: "pending",
  totalPriceCents: 450,
  createdAt: "2026-10-27T12:00:00.000Z",
} as const;

const ticketId = ticket.id;

/** A model field as the page reads it: the loaded data, or a test's failure. */
const dataOf = <A>(field: AsyncData.AsyncData<A, string>): A =>
  Option.getOrThrow(AsyncData.getData(field));

/** An order in the domain's own shape, as its commands reply with it. */
const orderReply = (status: CoffeeOrder["status"]) =>
  Schema.decodeSync(CoffeeOrder)({
    id: ticketId,
    customerName: "Ada",
    ownerUserId: "user-1",
    items: [
      {
        drinkId: "latte",
        drinkName: "Latte",
        size: "medium",
        milk: "whole",
        temperature: "hot",
        shots: 1,
        quantity: 1,
        unitPrice: { currency: "USD", minorUnits: 518 },
        lineTotal: { currency: "USD", minorUnits: 518 },
      },
    ],
    status,
    totalPrice: { currency: "USD", minorUnits: 518 },
    createdAt: DateTime.makeUnsafe("2026-10-27T12:00:00.000Z"),
  });

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

/** The staff command the app sends, as the staff Api's client builds it. */
const startBrewing = (commandId: string) =>
  StaffDomain.StartBrewing({
    target: OrderId.make(ticketId),
    input: {},
    commandId,
  });

const names = (pathname: string) =>
  init(flags, url(pathname)).commands?.map((command) => command.name);

describe("boot", () => {
  test("every page loads the viewer, and only the customer page the menu", () => {
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
        expect(dataOf(next.viewer)).toEqual(customer);
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
      given({
        ...bootModel("/staff"),
        viewer: ViewerData.Success({ data: staff }),
        orders: OrdersData.Success({ data: [ticket] }),
      }),
      message(Message.ClickedSignOut()),
      Command.expectExact(RunPasskeyAuth),
      Command.resolve(RunPasskeyAuth, Message.SucceededAuth({ action: "sign-out" })),
      Command.expectExact(FetchViewer),
      model((next) => expect(dataOf(next.viewer)).toEqual({ kind: "anonymous" })),
      Command.resolve(FetchViewer, Message.SucceededFetchViewer({ viewer: { kind: "anonymous" } })),
      message(Message.LoadedOrders({ feed: staffFeed, userId: "user-2", orders: [ticket] })),
      model((next) => expect(dataOf(next.orders)).toEqual([])),
    );
  });
});

describe("customer orders", () => {
  const signedIn = {
    ...bootModel("/shop"),
    viewer: ViewerData.Success({ data: customer }),
    menu: MenuData.Success({ data: [latte] }),
  };

  /** The draft the composer shows for the menu, as the app sends it. */
  const orderRequest = toPlaceOrderRequest(
    Option.getOrThrow(composerFor([latte], Option.none())).draft,
  );

  /** What the domain replies with: the ticket, in its own shape. */
  const domainOrder = orderReply("pending");

  /** The same ticket as the components render it. */
  const placedTicket: OrderTicket = {
    id: ticketId,
    customerName: "Ada",
    ownerUserId: "user-1",
    items: [
      {
        drinkId: "latte",
        drinkName: "Latte",
        size: "medium",
        milk: "whole",
        temperature: "hot",
        shots: 1,
        quantity: 1,
        unitPriceCents: 518,
        lineTotalCents: 518,
      },
    ],
    status: "pending",
    totalPriceCents: 518,
    createdAt: "2026-10-27T12:00:00.000Z",
  };

  /** The command the app sends, as the customer Api's client builds it. */
  const placeOrder = (commandId: string) =>
    CustomerDomain.PlaceOrder({
      target: OrderId.make(ticketId),
      input: orderRequest,
      commandId,
    });

  test("sending an order opens a ticket, then places it and shows the receipt", () => {
    story(
      update,
      given(signedIn),
      message(Message.ClickedSendOrder()),
      Command.expectExact(StartOrder),
      model((next) => expect(next.isPlacingOrder).toBe(true)),
      Command.resolve(StartOrder, Message.StartedOrder({ commandId: "test:0", orderId: ticketId })),
      Command.expectExact(placeOrder("test:0")),
      Command.resolve(placeOrder("test:0"), {
        _tag: "SucceededPlaceOrder",
        commandId: "test:0",
        reply: { order: domainOrder },
        receipt: { stream: `CoffeeShop/${ticketId}`, version: 1 },
      }),
      Command.resolve(Dialog.ShowDialog, Dialog.Message.SucceededShowDialog()),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-0" }),
      model((next) => {
        expect(next.isPlacingOrder).toBe(false);
        expect(next.receipt).toEqual(Option.some(placedTicket));
        expect(next.toast.entries).toHaveLength(0);
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

  test("an uncertain outcome is retried with the same ticket and command id", () => {
    story(
      update,
      given(signedIn),
      message(Message.ClickedSendOrder()),
      Command.resolve(StartOrder, Message.StartedOrder({ commandId: "test:0", orderId: ticketId })),
      Command.resolve(placeOrder("test:0"), {
        _tag: "FailedPlaceOrder",
        commandId: "test:0",
        failure: { _tag: "Unknown" },
      }),
      model((next) => {
        expect(next.isPlacingOrder).toBe(false);
        expect(next.pendingOrder.pipe(Option.map((pending) => pending.commandId))).toEqual(
          Option.some("test:0"),
        );
        expect(next.toast.entries.map((entry) => entry.payload.message)).toEqual([
          "Unable to reach the coffee shop. Check your connection and try again.",
        ]);
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-0" }),
      message(Message.ClickedSendOrder()),
      // The same ids go out again: a reply lost after the write cannot make a second ticket.
      Command.resolve(placeOrder("test:0"), {
        _tag: "FailedPlaceOrder",
        commandId: "test:0",
        failure: { _tag: "Unknown" },
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-1" }),
    );
  });

  test("a refusal explains itself, and the next attempt opens a new ticket", () => {
    story(
      update,
      given(signedIn),
      message(Message.ClickedSendOrder()),
      Command.resolve(StartOrder, Message.StartedOrder({ commandId: "test:0", orderId: ticketId })),
      Command.resolve(placeOrder("test:0"), {
        _tag: "FailedPlaceOrder",
        commandId: "test:0",
        failure: { _tag: "Rejected", rejection: { _tag: "DrinkNotFound", drinkId: "espresso" } },
      }),
      model((next) => {
        expect(Option.isNone(next.pendingOrder)).toBe(true);
        expect(next.toast.entries.map((entry) => entry.payload.message)).toEqual([
          '"espresso" is not on the menu.',
        ]);
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-0" }),
      message(Message.ClickedSendOrder()),
      // The old ticket is finished with, so the next attempt allocates a new id.
      Command.expectExact(StartOrder({ commandId: "test:1" })),
      Command.resolve(
        StartOrder({ commandId: "test:1" }),
        Message.StartedOrder({ commandId: "test:1", orderId: ticketId }),
      ),
      Command.expectExact(placeOrder("test:1")),
      Command.resolve(placeOrder("test:1"), {
        _tag: "FailedPlaceOrder",
        commandId: "test:1",
        failure: { _tag: "Denied", error: new Unauthorized() },
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-1" }),
      model((next) => expect(next.toast.entries).toEqual([])),
    );
  });

  test("the live feed owns the list", () => {
    story(
      update,
      given(signedIn),
      message(Message.LoadedOrders({ feed: customerFeed, userId: "user-1", orders: [ticket] })),
      model((next) => {
        expect(dataOf(next.orders)).toEqual([ticket]);
        expect(Option.isNone(AsyncData.getError(next.orders))).toBe(true);
      }),
    );
  });
});

describe("staff queue", () => {
  const staffModel = { ...bootModel("/staff"), viewer: ViewerData.Success({ data: staff }) };

  test("an order action carries a command id, then shows the reply right away", () => {
    story(
      update,
      given({ ...staffModel, orders: OrdersData.Success({ data: [ticket] }) }),
      message(Message.ClickedOrderAction({ orderId: ticketId, action: "start-brewing" })),
      Command.expectExact(startBrewing("test:0")),
      model((next) => expect(next.pendingOrderId).toEqual(Option.some(ticketId))),
      Command.resolve(startBrewing("test:0"), {
        _tag: "SucceededStartBrewing",
        commandId: "test:0",
        reply: { order: orderReply("brewing") },
        receipt: { stream: `CoffeeShop/${ticketId}`, version: 2 },
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-0" }),
      model((next) => {
        expect(next.pendingOrderId).toEqual(Option.none());
        // The reply drives the toast and the pending flag; the feed still owns the queue.
        expect(dataOf(next.orders)).toEqual([ticket]);
      }),
    );
  });

  test("a refused action says why, and the next attempt gets a new command id", () => {
    story(
      update,
      given({ ...staffModel, orders: OrdersData.Success({ data: [ticket] }) }),
      message(Message.ClickedOrderAction({ orderId: ticketId, action: "start-brewing" })),
      Command.resolve(startBrewing("test:0"), {
        _tag: "FailedStartBrewing",
        commandId: "test:0",
        failure: { _tag: "Rejected", rejection: { _tag: "StaffOnly" } },
      }),
      model((next) => {
        expect(next.pendingOrderId).toEqual(Option.none());
        expect(next.toast.entries.map((entry) => entry.payload.message)).toEqual([
          "Only coffee-shop staff can do that.",
        ]);
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-0" }),
      message(Message.ClickedOrderAction({ orderId: ticketId, action: "start-brewing" })),
      Command.expectExact(startBrewing("test:1")),
      Command.resolve(startBrewing("test:1"), {
        _tag: "SucceededStartBrewing",
        commandId: "test:1",
        reply: { order: orderReply("brewing") },
        receipt: { stream: `CoffeeShop/${ticketId}`, version: 2 },
      }),
      UiToast.test.drainEntry({ entryId: "app-toast-entry-1" }),
    );
  });

  test("a staff queue message from another staff account is ignored", () => {
    story(
      update,
      given({ ...staffModel, orders: OrdersData.Success({ data: [ticket] }) }),
      message(Message.LoadedOrders({ feed: staffFeed, userId: "user-9", orders: [] })),
      model((next) => expect(dataOf(next.orders)).toEqual([ticket])),
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
      given({ ...bootModel("/staff"), viewer: ViewerData.Success({ data: staff }) }),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.expectHas(FetchMenu),
      Command.resolve(FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })),
      model((next) => expect(dataOf(next.menu)).toHaveLength(1)),
    );
  });

  test("switching accounts drops the previous orders", () => {
    story(
      update,
      given({
        ...bootModel("/shop"),
        viewer: ViewerData.Success({ data: customer }),
        orders: OrdersData.Success({ data: [ticket] }),
      }),
      message(
        Message.SucceededFetchViewer({
          viewer: { ...customer, userId: "user-9", displayName: "Bo" },
        }),
      ),
      Command.expectHas(FetchMenu),
      Command.resolve(FetchMenu, Message.SucceededFetchMenu({ menu: [latte] })),
      model((next) => expect(dataOf(next.orders)).toEqual([])),
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
      given({
        ...bootModel("/staff"),
        viewer: ViewerData.Success({ data: customer }),
        menu: MenuData.Success({ data: [latte] }),
      }),
      message(Message.ChangedUrl({ url: url("/login/mcp") })),
      Command.expectExact(LoadExternal),
      Command.resolve(LoadExternal, Message.CompletedLoadExternal()),
    );
  });

  test("a detour through an unknown page clears the orders, and the next snapshot refills them", () => {
    story(
      update,
      given({
        ...bootModel("/shop"),
        viewer: ViewerData.Success({ data: customer }),
        menu: MenuData.Success({ data: [latte] }),
        orders: OrdersData.Success({ data: [ticket] }),
      }),
      message(Message.ChangedUrl({ url: url("/nope") })),
      model((next) => expect(dataOf(next.orders)).toEqual([])),
      message(Message.ChangedUrl({ url: url("/shop") })),
      Command.expectNone(),
      message(Message.LoadedOrders({ feed: customerFeed, userId: "user-1", orders: [ticket] })),
      model((next) => expect(dataOf(next.orders)).toEqual([ticket])),
    );
  });

  test("a feed message for another account is ignored", () => {
    story(
      update,
      given({
        ...bootModel("/shop"),
        viewer: ViewerData.Success({ data: customer }),
        menu: MenuData.Success({ data: [latte] }),
        orders: OrdersData.Success({ data: [ticket] }),
      }),
      message(
        Message.LoadedOrders({
          feed: { _tag: "CustomerOrders", customerId: "user-9" },
          userId: "user-9",
          orders: [],
        }),
      ),
      message(
        Message.FailedOrders({
          feed: staffFeed,
          userId: "user-2",
          message: "Live updates disconnected.",
        }),
      ),
      model((next) => {
        expect(dataOf(next.orders)).toEqual([ticket]);
        expect(Option.isNone(AsyncData.getError(next.orders))).toBe(true);
      }),
    );
  });
});

const feedOf = (pathname: string, viewer: Viewer) =>
  Option.getOrElse(feedFor(viewer, urlToAppRoute(url(pathname))), () => "none");

describe("feeds", () => {
  test("only the page's own feed is shown to its own viewer", () => {
    expect([
      feedOf("/shop", customer),
      feedOf("/coffee-shop", customer),
      feedOf("/staff", staff),
      feedOf("/staff", customer),
      feedOf("/login/mcp", customer),
      feedOf("/nope", customer),
      feedOf("/shop", { kind: "anonymous" }),
    ]).toEqual([
      { _tag: "CustomerOrders", customerId: "user-1" },
      { _tag: "CustomerOrders", customerId: "user-1" },
      { _tag: "OrderQueue" },
      "none",
      "none",
      "none",
      "none",
    ]);
  });
});
