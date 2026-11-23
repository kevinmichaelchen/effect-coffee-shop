import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Equal, Option, Result, Schema } from "effect";
import * as AsyncData from "foldkit/asyncData";
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
  FetchMenu,
  FetchViewer,
  LoadExternal,
  NavigateInternal,
  placeOrder,
  runOrderAction,
  RunPasskeyAuth,
  ScrollToOrders,
  StartOrder,
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
} from "#app/dialogs.ts";
import {
  enableAssistant,
  enableVoice,
  abandonInteraction,
  receiveCrash,
  receiveLoadFailed,
  receiveMicrophone,
  receiveWorkerAcquired,
  receiveWorkerReleased,
  receiveLoaded,
  receiveProgress,
  receiveRecordingFailed,
  receiveTranscript,
  receiveTranscriptFailed,
  receiveTurn,
  receiveTurnFailed,
  receiveWebGpu,
  settleTurn,
  startRecording,
  stopRecording,
  submitPrompt,
  undoEdit,
  useUsual,
} from "#app/assistant.ts";
import { composerFor, selectDrink, toInt } from "#app/draft.ts";
import { feedFor, type Feed } from "#app/feed.ts";
import { Message } from "../message.ts";
import {
  MenuData,
  OrdersData,
  ViewerData,
  menuOf,
  viewerOf,
  type AuthAction,
  type Model,
  type OrderActionName,
} from "#app/model.ts";
import type { UpdateReturn, UpdateStep } from "#app/resources.ts";
import { type AppRoute, mcpAuthorizePath, urlToAppRoute } from "#app/route.ts";
import { foldToast, withToast } from "#app/toast.ts";

// SESSION

const userIdOf = (model: Model): Option.Option<string> => {
  const viewer = viewerOf(model);
  return viewer.kind === "anonymous" ? Option.none() : Option.some(viewer.userId);
};

const wantsMenu = (model: Model): boolean =>
  (model.route._tag === "Shop" || model.route._tag === "McpLogin") && menuOf(model).length === 0;

const withMenuFetch = (result: UpdateReturn): UpdateReturn =>
  wantsMenu(result.model)
    ? { model: result.model, commands: [...(result.commands ?? []), FetchMenu()] }
    : result;

/** Orders survive only a move that keeps the same account watching the same feed. */
const keepsOrders = (before: Model, after: Model): boolean =>
  Equal.equals(userIdOf(before), userIdOf(after)) &&
  Equal.equals(feedFor(viewerOf(before), before.route), feedFor(viewerOf(after), after.route));

/** A feed message counts only for the account and feed the page shows now. */
const isCurrentFeed = (model: Model, feed: Feed, userId: string): boolean =>
  Option.contains(feedFor(viewerOf(model), model.route), feed) &&
  Option.contains(userIdOf(model), userId);

/** Stores the feed's snapshot; an open drawer whose ticket disappeared closes. */
const applyOrders = (model: Model, orders: readonly OrderTicket[]): UpdateReturn => {
  const next: Model = { ...model, orders: OrdersData.Success({ data: orders }) };
  const vanished = Option.exists(
    next.selectedOrderId,
    (id) => !orders.some((order) => order.id === id),
  );
  return vanished ? closeDetails({ ...next, detailsError: Option.none() }) : { model: next };
};

const withoutOrders = (model: Model): Model => ({
  ...model,
  orders: OrdersData.Success({ data: [] }),
  selectedOrderId: Option.none(),
});

/** Leaving an account behind: its pending action, copy feedback and orders go with it. */
const withoutAccountState = (model: Model): Model => ({
  ...withoutOrders(abandonInteraction(model)),
  isPlacingOrder: false,
  pendingOrder: Option.none(),
  pendingOrderId: Option.none(),
  orderActionAttempt: Option.none(),
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
  result.model.route._tag === "McpLogin" && viewerOf(result.model).kind !== "anonymous"
    ? {
        model: result.model,
        commands: [...(result.commands ?? []), LoadExternal({ href: mcpAuthorizePath })],
      }
    : result;

// COMPOSER

const editDraft =
  (change: (draft: OrderDraft) => OrderDraft) =>
  (model: Model): UpdateReturn =>
    Option.match(composerFor(menuOf(model), model.draft), {
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
    // Signing out drops the viewer at once, so the open feed closes before it can refill orders.
    const signedOut: Model =
      action === "sign-out"
        ? { ...model, viewer: ViewerData.Success({ data: anonymousViewer }) }
        : model;
    const cleared: Model = { ...withoutAccountState(signedOut), pendingAuth: Option.none() };
    return action !== "sign-out" && cleared.route._tag === "McpLogin"
      ? { model: cleared, commands: [LoadExternal({ href: mcpAuthorizePath })] }
      : { model: cleared, commands: [FetchViewer()] };
  };

/** Only the customer who placed it, still on the customer page, gets the receipt. */
const receiveOrderPlaced = (model: Model, order: OrderTicket): UpdateReturn =>
  model.route._tag !== "Shop" || !Option.contains(userIdOf(model), order.ownerUserId)
    ? { model: { ...model, isPlacingOrder: false } }
    : Update.combine(
        { ...model, isPlacingOrder: false, draft: Option.none(), receipt: Option.some(order) },
        [openReceipt, withToast("success", `Ticket ${order.id} queued for your account.`)],
      );

/** A modal drawer hides the toast region, so the failure also shows inside that ticket's drawer. */
const receiveOrderActionFailed = (
  model: Model,
  message: string,
  retryable: boolean,
): UpdateReturn =>
  withToast(
    "error",
    message,
  )({
    ...model,
    pendingOrderId: Option.none(),
    // A refusal is final; an unknown outcome keeps its ids for the retry.
    orderActionAttempt: retryable ? model.orderActionAttempt : Option.none(),
    detailsError: Option.filter(
      Option.map(model.selectedOrderId, () => message),
      () => Equal.equals(model.selectedOrderId, model.pendingOrderId),
    ),
  });

/**
 * Sends the draft as a new ticket. An attempt whose outcome was unknown is
 * sent again with its own ids, so the write cannot land twice; a draft that
 * changed since starts a new ticket.
 */
const sendOrder = (model: Model): UpdateReturn => {
  const composer = composerFor(menuOf(model), model.draft);
  if (Option.isNone(composer)) return { model };

  const request = toPlaceOrderRequest(composer.value.draft);
  const retry = Option.filter(model.pendingOrder, (pending) =>
    Equal.equals(pending.request, request),
  );
  if (Option.isSome(retry)) {
    const pending = retry.value;
    // StartOrder has not answered yet, so there is no ticket to address.
    if (Option.isNone(pending.orderId)) return { model };
    const command = placeOrder({
      commandId: pending.commandId,
      orderId: pending.orderId.value,
      request,
    });
    const next = settleTurn({ ...model, isPlacingOrder: true, pendingOrder: retry });
    return { model: next, commands: [command] };
  }

  const { commandId, commandIds } = DomainFoldkit.next(model.commandIds);
  const next = settleTurn({
    ...model,
    commandIds,
    isPlacingOrder: true,
    pendingOrder: Option.some({ commandId, orderId: Option.none(), request }),
  });
  return { model: next, commands: [StartOrder({ commandId })] };
};

/**
 * Runs one staff action. A retry of an action whose outcome was unknown goes
 * out with the same command id, so the ticket moves once.
 */
const runAction = (model: Model, orderId: string, action: OrderActionName): UpdateReturn => {
  const retry = Option.filter(
    model.orderActionAttempt,
    (attempt) => attempt.orderId === orderId && attempt.action === action,
  );
  const pending: Model = settleTurn({
    ...model,
    pendingOrderId: Option.some(orderId),
    detailsError: Option.none(),
  });
  return Option.match(retry, {
    onSome: (attempt) => ({ model: pending, commands: [runOrderAction(attempt)] }),
    onNone: () => {
      const { commandId, commandIds } = DomainFoldkit.next(model.commandIds);
      const attempt = { commandId, orderId, action };
      return {
        model: { ...pending, commandIds, orderActionAttempt: Option.some(attempt) },
        commands: [runOrderAction(attempt)],
      };
    },
  });
};

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
      const moved: Model = abandonInteraction({ ...model, route: urlToAppRoute(url) });
      const left = closeOverlays(keepsOrders(model, moved) ? moved : withoutOrders(moved));
      const arrived = continueMcp(withMenuFetch({ model: left.model }));
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
      const settled: Model = { ...model, viewer: ViewerData.Success({ data: viewer }) };
      const next = keepsOrders(model, settled) ? settled : withoutAccountState(settled);
      // Someone already signed in who lands on the MCP login page continues straight on.
      return next.route._tag === "McpLogin" && viewer.kind !== "anonymous"
        ? { model: next, commands: [LoadExternal({ href: mcpAuthorizePath })] }
        : withMenuFetch({ model: next });
    },
    FailedFetchViewer: ({ message }) => ({
      model: { ...model, viewer: ViewerData.Failure({ error: message }) },
    }),

    ChangedDisplayName: ({ value }) => ({ model: { ...model, displayName: value } }),
    ClickedCreateAccount: () => startAuth("create-account")(model),
    ClickedSignIn: () => startAuth("sign-in")(model),
    ClickedSignOut: () => startAuth("sign-out")(model),
    SucceededAuth: ({ action }) => afterAuth(action)(model),
    FailedAuth: ({ message }) => ({
      model: { ...model, pendingAuth: Option.none(), authError: Option.some(message) },
    }),

    SucceededFetchMenu: ({ menu }) => ({
      model: { ...model, menu: MenuData.Success({ data: menu }) },
    }),
    FailedFetchMenu: ({ message }) => ({
      model: { ...model, menu: AsyncData.settle(model.menu, Result.fail(message)) },
    }),

    // A feed message counts only while the page still shows that feed.
    LoadedOrders: ({ feed, userId, orders }) =>
      isCurrentFeed(model, feed, userId) ? applyOrders(model, orders) : { model },
    FailedOrders: ({ feed, userId, message }) =>
      isCurrentFeed(model, feed, userId)
        ? { model: { ...model, orders: AsyncData.settle(model.orders, Result.fail(message)) } }
        : { model },

    ClickedSelectDrink: ({ drinkId }) => ({
      model: { ...model, draft: selectDrink(menuOf(model), model.draft, drinkId) },
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

    ClickedSendOrder: () => (model.isPlacingOrder ? { model } : sendOrder(model)),
    StartedOrder: ({ commandId, orderId }) =>
      Option.match(model.pendingOrder, {
        onNone: () => ({ model }),
        onSome: (pending) =>
          pending.commandId === commandId
            ? {
                model: {
                  ...model,
                  pendingOrder: Option.some({ ...pending, orderId: Option.some(orderId) }),
                },
                commands: [placeOrder({ commandId, orderId, request: pending.request })],
              }
            : { model },
      }),
    SucceededPlaceOrder: ({ order }) =>
      receiveOrderPlaced({ ...model, pendingOrder: Option.none() }, order),
    FailedPlaceOrder: ({ message, retryable }) =>
      withToast(
        "error",
        message,
      )({
        ...model,
        isPlacingOrder: false,
        // A refusal is final; an unknown outcome keeps its ids for the retry.
        pendingOrder: retryable ? model.pendingOrder : Option.none(),
      }),

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
      Option.isSome(model.pendingOrderId) ? { model } : runAction(model, orderId, action),
    SucceededOrderAction: ({ order }) =>
      withToast(
        "success",
        `${getOrderTitle(order)} moved to ${order.status}.`,
      )({
        ...model,
        pendingOrderId: Option.none(),
        orderActionAttempt: Option.none(),
        detailsError: Option.none(),
      }),
    // A modal drawer hides the toast region, so a failure also shows inside the drawer.
    FailedOrderAction: ({ message, retryable }) =>
      receiveOrderActionFailed(model, message, retryable),
    ClickedCopyUserId: () => {
      const viewer = viewerOf(model);
      return viewer.kind === "anonymous"
        ? { model }
        : { model, commands: [CopyUserId({ userId: viewer.userId })] };
    },
    SucceededCopyUserId: () => ({ model: { ...model, copyState: "copied" } }),
    FailedCopyUserId: () => ({ model: { ...model, copyState: "failed" } }),
    GotDetailsDialogMessage: ({ message }) => foldDetails(model, message),

    ClickedOpenMenu: () => openMenu(model),
    GotMenuDialogMessage: ({ message }) => foldMenu(model, message),

    GotToastMessage: ({ message }) => foldToast(model, message),

    ClickedEnableAssistant: () => enableAssistant(model),
    DetectedWebGpu: ({ isSupported }) => receiveWebGpu(model, isSupported),
    AcquiredAssistantWorker: () => receiveWorkerAcquired(model),
    FailedAcquireAssistantWorker: ({ message }) => receiveLoadFailed(model, "text", message),
    ReleasedAssistantWorker: () => receiveWorkerReleased(model),
    CrashedAssistantWorker: ({ message }) => receiveCrash(model, message),
    ReportedModelProgress: ({ model: which, loaded, total }) =>
      receiveProgress(model, which, loaded, total),
    LoadedLocalModel: ({ model: which }) => receiveLoaded(model, which),
    FailedLoadLocalModel: ({ model: which, message }) => receiveLoadFailed(model, which, message),
    ClickedEnableVoice: () => enableVoice(model),
    ChangedAssistantPrompt: ({ value }) => ({
      model: { ...model, assistant: { ...model.assistant, prompt: value } },
    }),
    SubmittedAssistantPrompt: () => submitPrompt(model),
    ReceivedAssistantTurn: ({ requestId, turn }) => receiveTurn(model, requestId, turn),
    FailedAssistantTurn: ({ requestId, message }) => receiveTurnFailed(model, requestId, message),
    ClickedUndoAssistantEdit: () => undoEdit(model),
    ClickedDismissAssistantTurn: () => ({ model: settleTurn(model) }),
    ClickedUseUsual: () => useUsual(model),
    ClickedStartRecording: () => startRecording(model),
    AcquiredMicrophone: () => receiveMicrophone(model),
    FailedAcquireMicrophone: ({ message }) => receiveRecordingFailed(model, message),
    ReleasedMicrophone: () => ({ model }),
    ClickedStopRecording: () => stopRecording(model),
    ReceivedTranscript: ({ recordingId, text }) => receiveTranscript(model, recordingId, text),
    FailedTranscript: ({ recordingId, message }) =>
      receiveTranscriptFailed(model, recordingId, message),

    CompletedNavigateInternal: () => ({ model }),
    CompletedLoadExternal: () => ({ model }),
    CompletedApplyTheme: () => ({ model }),
  });

/** What the app asks for when it boots on a route. */
export const bootCommands = (route: AppRoute) =>
  route._tag === "NotFound" || route._tag === "Staff"
    ? [FetchViewer()]
    : [FetchViewer(), FetchMenu()];
