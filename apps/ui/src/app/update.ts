import { Equal, Match, Option, Schema } from "effect";
import { Update } from "foldkit";
import { UrlRequest } from "foldkit/navigation";
import { toString as urlToString } from "foldkit/url";
import { toggledTheme } from "@effect-coffee-shop/ui-kit/components/theme";
import { anonymousViewer } from "#features/auth/lib/viewer.ts";
import { DrinkSize, Milk, Temperature } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { toPlaceOrderRequest } from "#features/coffee-shop/lib/coffee.ts";
import { getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import type { OrderDraft, OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import {
  ApplyTheme,
  CopyUserId,
  FetchCustomerOrders,
  FetchMenu,
  FetchStaffQueue,
  FetchViewer,
  LoadExternal,
  NavigateInternal,
  PlaceOrder,
  RunOrderAction,
  RunPasskeyAuth,
  ScrollToOrders,
} from "#app/command.ts";
import {
  foldDetails,
  foldMenu,
  foldReceipt,
  closeDetails,
  closeMenu,
  closeReceipt,
  openDetails,
  openMenu,
  openReceipt,
  withToast,
} from "#app/dialogs.ts";
import { composerFor, selectDrink, toInt } from "#app/draft.ts";
import { Message } from "#app/message.ts";
import type { AuthAction, Model, OrdersSource } from "#app/model.ts";
import { AppRoute, mcpAuthorizePath, urlToAppRoute } from "#app/route.ts";

type UpdateReturn = Update.Return<Model, Message>;
type UpdateStep = Update.Step<Model, Message>;

// SESSION

const userIdOf = (model: Model): Option.Option<string> =>
  model.viewer.kind === "anonymous" ? Option.none() : Option.some(model.viewer.userId);

const isStaff = (model: Model): boolean => model.viewer.kind === "staff";

/** What the orders list on the current page should be fetched from. */
export const ordersSource = (model: Model): Option.Option<OrdersSource> =>
  Match.value(model.route).pipe(
    Match.tag("Shop", () =>
      Option.isSome(userIdOf(model)) ? Option.some("customer" as const) : Option.none(),
    ),
    Match.tag("Staff", () => (isStaff(model) ? Option.some("staff" as const) : Option.none())),
    Match.orElse(() => Option.none()),
  );

const refreshOrders = (model: Model): UpdateReturn =>
  Option.match(ordersSource(model), {
    onNone: () => ({ model }),
    onSome: (source) => ({
      model: { ...model, isRefreshingOrders: true },
      commands:
        source === "staff"
          ? [FetchStaffQueue({ userId: Option.getOrElse(userIdOf(model), () => "") })]
          : [FetchCustomerOrders({ userId: Option.getOrElse(userIdOf(model), () => "") })],
    }),
  });

/** A poll tick never overlaps a fetch that is still in flight. */
const refreshOnTick = (model: Model): UpdateReturn => {
  const refreshed = model.isRefreshingOrders ? { model } : refreshOrders(model);
  // A failed menu load is retried on the next tick instead of stranding the composer.
  return wantsMenu(model) && Option.isSome(model.menuError)
    ? { model: refreshed.model, commands: [...(refreshed.commands ?? []), FetchMenu()] }
    : refreshed;
};

/** A reply counts only if it answers the question the page is asking right now. */
const answersCurrentPage = (
  model: Model,
  reply: { readonly source: OrdersSource; readonly userId: string },
): boolean =>
  Option.contains(ordersSource(model), reply.source) &&
  Option.contains(userIdOf(model), reply.userId);

const wantsMenu = (model: Model): boolean =>
  (model.route._tag === "Shop" || model.route._tag === "McpLogin") && model.menu.length === 0;

const withMenuFetch = (result: UpdateReturn): UpdateReturn =>
  wantsMenu(result.model)
    ? { model: result.model, commands: [...(result.commands ?? []), FetchMenu()] }
    : result;

/** Stores fresh orders; an open drawer whose ticket disappeared closes. */
const applyOrders = (model: Model, orders: readonly OrderTicket[]): UpdateReturn => {
  const next: Model = { ...model, orders, ordersError: Option.none(), isRefreshingOrders: false };
  const vanished = Option.exists(
    next.selectedOrderId,
    (id) => !orders.some((order) => order.id === id),
  );
  return vanished ? closeDetails({ ...next, detailsError: Option.none() }) : { model: next };
};

const withoutOrders = (model: Model): Model => ({
  ...model,
  orders: [],
  ordersError: Option.none(),
  isRefreshingOrders: false,
  selectedOrderId: Option.none(),
});

/** Leaving an account behind: its pending action, copy feedback and orders go with it. */
const withoutAccountState = (model: Model): Model => ({
  ...withoutOrders(model),
  pendingOrderId: Option.none(),
  detailsError: Option.none(),
  copyState: "idle",
});

/** A route change also dismisses overlays that belonged to the page being left. */
const closeOverlays: UpdateStep = (model) =>
  Update.combine(model, [
    ...(Option.isSome(model.selectedOrderId) ? [closeDetails] : []),
    ...(Option.isSome(model.receipt) ? [closeReceipt] : []),
  ]);

/** Signed-in visitors on the MCP login page continue straight to authorization. */
const continueMcp = (result: UpdateReturn): UpdateReturn =>
  result.model.route._tag === "McpLogin" && result.model.viewer.kind !== "anonymous"
    ? {
        model: result.model,
        commands: [...(result.commands ?? []), LoadExternal({ href: mcpAuthorizePath })],
      }
    : result;

const upsertOrder = (orders: readonly OrderTicket[], order: OrderTicket): readonly OrderTicket[] =>
  orders.some((existing) => existing.id === order.id)
    ? orders.map((existing) => (existing.id === order.id ? order : existing))
    : [...orders, order];

// COMPOSER

const editDraft =
  (change: (draft: OrderDraft) => OrderDraft) =>
  (model: Model): UpdateReturn =>
    Option.match(composerFor(model.menu, model.draft), {
      onNone: () => ({ model }),
      onSome: ({ draft }) => ({ model: { ...model, draft: Option.some(change(draft)) } }),
    });

const decodedOr = <A, I>(schema: Schema.Codec<A, I>, value: string, fallback: A): A =>
  Option.getOrElse(Schema.decodeUnknownOption(schema)(value), () => fallback);

// AUTH

const startAuth =
  (action: AuthAction) =>
  (model: Model): UpdateReturn => {
    if (action === "create-account" && model.displayName.trim().length === 0) {
      return {
        model: {
          ...model,
          authError: Option.some("Enter the name you want printed on your orders."),
        },
      };
    }
    return {
      model: { ...model, pendingAuth: Option.some(action), authError: Option.none() },
      commands: [RunPasskeyAuth({ action, displayName: model.displayName.trim() })],
    };
  };

const afterAuth =
  (action: AuthAction) =>
  (model: Model): UpdateReturn => {
    const cleared: Model = { ...withoutAccountState(model), pendingAuth: Option.none() };
    return action !== "sign-out" && cleared.route._tag === "McpLogin"
      ? { model: cleared, commands: [LoadExternal({ href: mcpAuthorizePath })] }
      : { model: cleared, commands: [FetchViewer()] };
  };

/** Only the customer who placed it, still on the customer page, gets the receipt. */
const receiveOrderPlaced = (model: Model, order: OrderTicket): UpdateReturn =>
  model.route._tag !== "Shop" || !Option.contains(userIdOf(model), order.ownerUserId)
    ? { model: { ...model, isPlacingOrder: false } }
    : Update.combine(
        {
          ...model,
          isPlacingOrder: false,
          draft: Option.none(),
          orders: upsertOrder(model.orders, order),
          receipt: Option.some(order),
        },
        [openReceipt, withToast("success", `Ticket ${order.id} queued for your account.`)],
      );

/** A modal drawer hides the toast region, so the failure also shows inside that ticket's drawer. */
const receiveOrderActionFailed = (model: Model, message: string): UpdateReturn =>
  withToast(
    "error",
    message,
  )({
    ...model,
    pendingOrderId: Option.none(),
    detailsError: Option.filter(
      Option.map(model.selectedOrderId, () => message),
      () => Equal.equals(model.selectedOrderId, model.pendingOrderId),
    ),
  });

// UPDATE

export const update = (model: Model, message: Message): UpdateReturn =>
  Message.match<UpdateReturn>(message, {
    ClickedLink: ({ request }) =>
      UrlRequest.match<UpdateReturn>(request, {
        Internal: ({ url }) =>
          Update.combine(model, [
            closeMenu,
            (next) => ({ model: next, commands: [NavigateInternal({ url: urlToString(url) })] }),
          ]),
        External: ({ href }) => ({ model, commands: [LoadExternal({ href })] }),
      }),

    ChangedUrl: ({ url }) => {
      const left = closeOverlays({ ...model, route: urlToAppRoute(url) });
      const arrived = continueMcp(withMenuFetch(refreshOrders(withoutOrders(left.model))));
      return {
        model: arrived.model,
        commands: [...(left.commands ?? []), ...(arrived.commands ?? [])],
      };
    },

    ClickedToggleTheme: () => {
      const theme = toggledTheme(model.theme);
      return { model: { ...model, theme }, commands: [ApplyTheme({ theme })] };
    },

    SucceededFetchViewer: ({ viewer }) => {
      const sameAccount = JSON.stringify(viewer) === JSON.stringify(model.viewer);
      const next: Model = {
        ...(sameAccount ? model : withoutAccountState(model)),
        viewer,
        viewerError: Option.none(),
      };
      // Someone already signed in who lands on the MCP login page continues straight on.
      return next.route._tag === "McpLogin" && viewer.kind !== "anonymous"
        ? { model: next, commands: [LoadExternal({ href: mcpAuthorizePath })] }
        : refreshOrders(next);
    },
    FailedFetchViewer: ({ message }) => ({
      model: { ...model, viewer: anonymousViewer, viewerError: Option.some(message) },
    }),

    ChangedDisplayName: ({ value }) => ({ model: { ...model, displayName: value } }),
    ClickedCreateAccount: () => startAuth("create-account")(model),
    ClickedSignIn: () => startAuth("sign-in")(model),
    ClickedSignOut: () => startAuth("sign-out")(model),
    SucceededAuth: ({ action }) => afterAuth(action)(model),
    FailedAuth: ({ message }) => ({
      model: { ...model, pendingAuth: Option.none(), authError: Option.some(message) },
    }),

    SucceededFetchMenu: ({ menu }) => ({ model: { ...model, menu, menuError: Option.none() } }),
    FailedFetchMenu: ({ message }) => ({ model: { ...model, menuError: Option.some(message) } }),

    TickedOrdersRefresh: () => refreshOnTick(model),
    SucceededFetchOrders: (reply) =>
      answersCurrentPage(model, reply) ? applyOrders(model, reply.orders) : { model },
    FailedFetchOrders: (reply) =>
      answersCurrentPage(model, reply)
        ? {
            model: { ...model, ordersError: Option.some(reply.message), isRefreshingOrders: false },
          }
        : { model },

    ClickedSelectDrink: ({ drinkId }) => ({
      model: { ...model, draft: selectDrink(model.menu, model.draft, drinkId) },
    }),
    ChangedDrinkSize: ({ value }) =>
      editDraft((draft) => ({ ...draft, size: decodedOr(DrinkSize, value, draft.size) }))(model),
    ChangedMilk: ({ value }) =>
      editDraft((draft) => ({ ...draft, milk: decodedOr(Milk, value, draft.milk) }))(model),
    ChangedTemperature: ({ value }) =>
      editDraft((draft) => ({
        ...draft,
        temperature: decodedOr(Temperature, value, draft.temperature),
      }))(model),
    ChangedShots: ({ value }) =>
      editDraft((draft) => ({ ...draft, shots: toInt(value, 0) }))(model),
    ChangedQuantity: ({ value }) =>
      editDraft((draft) => ({ ...draft, quantity: Math.max(toInt(value, 1), 1) }))(model),
    ChangedNotes: ({ value }) => editDraft((draft) => ({ ...draft, notes: value }))(model),

    ClickedSendOrder: () =>
      model.isPlacingOrder
        ? { model }
        : Option.match(composerFor(model.menu, model.draft), {
            onNone: () => ({ model }),
            onSome: ({ draft }) => ({
              model: { ...model, isPlacingOrder: true },
              commands: [PlaceOrder({ request: toPlaceOrderRequest(draft) })],
            }),
          }),
    SucceededPlaceOrder: ({ order }) => receiveOrderPlaced(model, order),
    FailedPlaceOrder: ({ message }) =>
      withToast("error", message)({ ...model, isPlacingOrder: false }),

    ClickedOpenMyOrders: () =>
      Update.combine(model, [
        closeReceipt,
        (next) => ({ model: next, commands: [ScrollToOrders()] }),
      ]),
    CompletedScrollToOrders: () => ({ model }),
    GotReceiptDialogMessage: ({ message }) => foldReceipt(model, message),

    ClickedInspectOrder: ({ orderId }) =>
      openDetails({ ...model, selectedOrderId: Option.some(orderId), detailsError: Option.none() }),
    ClickedOrderAction: ({ orderId, action }) =>
      Option.isSome(model.pendingOrderId)
        ? { model }
        : {
            model: { ...model, pendingOrderId: Option.some(orderId), detailsError: Option.none() },
            commands: [RunOrderAction({ orderId, action })],
          },
    SucceededOrderAction: ({ order }) =>
      withToast(
        "success",
        `${getOrderTitle(order)} moved to ${order.status}.`,
      )({
        ...model,
        pendingOrderId: Option.none(),
        detailsError: Option.none(),
        orders: model.route._tag === "Staff" ? upsertOrder(model.orders, order) : model.orders,
      }),
    // A modal drawer hides the toast region, so a failure also shows inside the drawer.
    FailedOrderAction: ({ message }) => receiveOrderActionFailed(model, message),
    ClickedCopyUserId: () =>
      model.viewer.kind === "anonymous"
        ? { model }
        : { model, commands: [CopyUserId({ userId: model.viewer.userId })] },
    SucceededCopyUserId: () => ({ model: { ...model, copyState: "copied" } }),
    FailedCopyUserId: () => ({ model: { ...model, copyState: "failed" } }),
    GotDetailsDialogMessage: ({ message }) => foldDetails(model, message),

    ClickedOpenMenu: () => openMenu(model),
    GotMenuDialogMessage: ({ message }) => foldMenu(model, message),

    DismissedToast: ({ id }) => ({
      model: { ...model, toasts: model.toasts.filter((toast) => toast.id !== id) },
    }),
    ExpiredToast: ({ id }) => ({
      model: { ...model, toasts: model.toasts.filter((toast) => toast.id !== id) },
    }),

    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedApplyTheme: () => ({ model }),
  });

/** What the app asks for when it boots on a route. */
export const bootCommands = (route: AppRoute) =>
  route._tag === "NotFound" || route._tag === "Staff"
    ? [FetchViewer()]
    : [FetchViewer(), FetchMenu()];
