import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { makeOrderId, OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Effect, Match, Option, Schema } from "effect";
import { Command } from "foldkit";
import { load, pushUrl } from "foldkit/navigation";
import { ThemePreference, themeStorageKey } from "@effect-coffee-shop/ui-kit/components/theme";
import {
  generateReply,
  loadModel,
  transcribeSamples,
} from "#features/assistant/api/assistant-worker.ts";
import { finishRecording } from "#features/assistant/api/microphone.ts";
import { messagesFor } from "#features/assistant/lib/prompt.ts";
import { LocalModel } from "#features/assistant/lib/protocol.ts";
import {
  AssistantRequest,
  decodeTurn,
  toolDefinitions,
  toolsFor,
} from "#features/assistant/lib/tools.ts";
import { authClient } from "#features/auth/auth-client.ts";
import { fetchMenu, fetchViewer } from "#features/coffee-shop/api/coffee-api.ts";
import { toCoffeeOrder } from "#features/coffee-shop/api/order-mapping.ts";
import {
  describeOrderFailure,
  isRetryable,
  type OrderFailure,
  unreachableMessage,
} from "#features/coffee-shop/api/order-failures.ts";
import type { PlaceOrderRequest } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AuthAction, type OrderActionName } from "#app/model.ts";
import { Message } from "../message.ts";

/** The customer Api as Foldkit Commands: each takes its target, input and command id. */
const CustomerDomain = DomainFoldkit.make(CustomerApi);

/** The staff Api as Foldkit Commands. */
const StaffDomain = DomainFoldkit.make(StaffApi);

type PlaceOrderResult = Extract<
  (typeof CustomerDomain)["Message"]["Type"],
  { readonly _tag: "SucceededPlaceOrder" | "FailedPlaceOrder" }
>;

const toPlaceOrderMessage = Match.type<PlaceOrderResult>().pipe(
  Match.tagsExhaustive({
    SucceededPlaceOrder: ({ reply }) =>
      Message.SucceededPlaceOrder({ order: toCoffeeOrder(reply.order) }),
    FailedPlaceOrder: ({ failure }) =>
      Message.FailedPlaceOrder({
        message: describeOrderFailure(failure),
        retryable: isRetryable(failure),
      }),
  }),
);

const orderActionSucceeded = (reply: { readonly order: CoffeeOrder }) =>
  Message.SucceededOrderAction({ order: toCoffeeOrder(reply.order) });

const orderActionFailed = (failure: OrderFailure) =>
  Message.FailedOrderAction({
    message: describeOrderFailure(failure),
    retryable: isRetryable(failure),
  });

const toOrderActionMessage = Match.type<(typeof StaffDomain)["Message"]["Type"]>().pipe(
  Match.tagsExhaustive({
    SucceededStartBrewing: ({ reply }) => orderActionSucceeded(reply),
    SucceededMarkReady: ({ reply }) => orderActionSucceeded(reply),
    SucceededPickUpOrder: ({ reply }) => orderActionSucceeded(reply),
    SucceededCancelOrder: ({ reply }) => orderActionSucceeded(reply),
    FailedStartBrewing: ({ failure }) => orderActionFailed(failure),
    FailedMarkReady: ({ failure }) => orderActionFailed(failure),
    FailedPickUpOrder: ({ failure }) => orderActionFailed(failure),
    FailedCancelOrder: ({ failure }) => orderActionFailed(failure),
  }),
);

/**
 * Turns an Effect's typed failure (every failure carries a readable message)
 * and any defect into a failure Message, so a Command's error channel is empty.
 */
const recoverWith =
  <Failed>(onFailure: (fields: { readonly message: string }) => Failed) =>
  <Success, Failure extends { readonly message: string }, R>(
    effect: Effect.Effect<Success, Failure, R>,
  ): Effect.Effect<Success | Failed, never, R> =>
    effect.pipe(
      Effect.catch((error) => Effect.succeed(onFailure({ message: error.message }))),
      Effect.catchCause(() => Effect.succeed(onFailure({ message: unreachableMessage }))),
    );

// NAVIGATION

export const NavigateInternal = Command.define("NavigateInternal", {
  args: { url: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ url }) => pushUrl(url).pipe(Effect.as(Message.CompletedNavigateInternal())),
});

export const LoadExternal = Command.define("LoadExternal", {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadExternal],
  execute: ({ href }) => load(href).pipe(Effect.as(Message.CompletedLoadExternal())),
});

// THEME

export const ApplyTheme = Command.define("ApplyTheme", {
  args: { theme: ThemePreference },
  messages: [Message.CompletedApplyTheme],
  execute: ({ theme }) =>
    Effect.sync(() => {
      document.documentElement.classList.toggle("dark", theme === "dark");
      window.localStorage.setItem(themeStorageKey, theme);
      return Message.CompletedApplyTheme();
    }),
});

// VIEWER AND PASSKEY AUTH

export const FetchViewer = Command.define("FetchViewer", {
  messages: [Message.SucceededFetchViewer, Message.FailedFetchViewer],
  execute: fetchViewer.pipe(
    Effect.map((viewer) => Message.SucceededFetchViewer({ viewer })),
    recoverWith(Message.FailedFetchViewer),
  ),
});

const runAuth = (action: AuthAction, displayName: string) => {
  const attempt =
    action === "create-account"
      ? authClient.register(displayName)
      : action === "sign-in"
        ? authClient.signIn()
        : authClient.signOut();
  return Effect.promise(async () => attempt).pipe(
    Effect.map((result) =>
      result.ok
        ? Message.SucceededAuth({ action })
        : Message.FailedAuth({ message: result.message }),
    ),
  );
};

export const RunPasskeyAuth = Command.define("RunPasskeyAuth", {
  args: { action: AuthAction, displayName: Schema.String },
  messages: [Message.SucceededAuth, Message.FailedAuth],
  execute: ({ action, displayName }) => runAuth(action, displayName),
});

// MENU AND ORDERS

export const FetchMenu = Command.define("FetchMenu", {
  messages: [Message.SucceededFetchMenu, Message.FailedFetchMenu],
  // The typed client already retries transient failures and times each attempt out.
  execute: fetchMenu.pipe(
    Effect.map((menu) => Message.SucceededFetchMenu({ menu })),
    recoverWith(Message.FailedFetchMenu),
  ),
});

/**
 * Opens a new ticket. Its id comes from the clock and randomness, so a Command
 * makes it; `update` then addresses PlaceOrder at it, and a retry of an
 * uncertain send reuses both ids.
 */
export const StartOrder = Command.define("StartOrder", {
  args: { commandId: Schema.String },
  messages: [Message.StartedOrder],
  execute: ({ commandId }) =>
    makeOrderId.pipe(Effect.map((orderId) => Message.StartedOrder({ commandId, orderId }))),
});

/** Places the ticket `StartOrder` opened; the ids come from the Model so a retry repeats it once. */
export const placeOrder = (args: {
  readonly commandId: string;
  readonly orderId: string;
  readonly request: PlaceOrderRequest;
}) =>
  Command.mapMessage(
    CustomerDomain.PlaceOrder({
      target: OrderId.make(args.orderId),
      input: args.request,
      commandId: args.commandId,
    }),
    toPlaceOrderMessage,
  );

/** Moves one ticket along the line; the command id comes from the Model so a retry moves it once. */
export const runOrderAction = (args: {
  readonly action: OrderActionName;
  readonly commandId: string;
  readonly orderId: string;
}) => {
  const { action, commandId, orderId } = args;
  const target = OrderId.make(orderId);
  const input = {};
  switch (action) {
    case "start-brewing":
      return Command.mapMessage(
        StaffDomain.StartBrewing({ target, input, commandId }),
        toOrderActionMessage,
      );
    case "mark-ready":
      return Command.mapMessage(
        StaffDomain.MarkReady({ target, input, commandId }),
        toOrderActionMessage,
      );
    case "pick-up":
      return Command.mapMessage(
        StaffDomain.PickUpOrder({ target, input, commandId }),
        toOrderActionMessage,
      );
    case "cancel":
      return Command.mapMessage(
        StaffDomain.CancelOrder({ target, input, commandId }),
        toOrderActionMessage,
      );
  }
};

// PAGE AND TOASTS

export const ScrollToOrders = Command.define("ScrollToOrders", {
  messages: [Message.CompletedScrollToOrders],
  // Wait a beat so the closing dialog has released its scroll lock first.
  execute: Effect.sleep("100 millis").pipe(
    Effect.map(() => {
      document.getElementById("my-orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return Message.CompletedScrollToOrders();
    }),
  ),
});

export const CopyUserId = Command.define("CopyUserId", {
  args: { userId: Schema.String },
  messages: [Message.SucceededCopyUserId, Message.FailedCopyUserId],
  execute: ({ userId }) =>
    Effect.promise(async () => navigator.clipboard.writeText(userId)).pipe(
      Effect.as(Message.SucceededCopyUserId()),
      Effect.catchCause(() => Effect.succeed(Message.FailedCopyUserId())),
    ),
});

// LOCAL AI

export const DetectWebGpu = Command.define("DetectWebGpu", {
  messages: [Message.DetectedWebGpu],
  // lib.dom declares `navigator.gpu` unconditionally, but browsers without WebGPU
  // (or outside a secure context) leave it undefined, so read it as an Option.
  execute: Effect.suspend(() =>
    Option.fromNullishOr(navigator.gpu).pipe(
      Option.match({
        onNone: () => Effect.succeed(false),
        onSome: (gpu) => Effect.promise(async () => (await gpu.requestAdapter()) !== null),
      }),
    ),
  ).pipe(Effect.map((isSupported) => Message.DetectedWebGpu({ isSupported }))),
});

export const LoadLocalModel = Command.define("LoadLocalModel", {
  args: { model: LocalModel },
  messages: [Message.LoadedLocalModel, Message.FailedLoadLocalModel],
  execute: ({ model }) =>
    loadModel(model).pipe(
      Effect.as(Message.LoadedLocalModel({ model })),
      recoverWith(({ message }) => Message.FailedLoadLocalModel({ model, message })),
    ),
});

export const AskAssistant = Command.define("AskAssistant", {
  args: { requestId: Schema.Int, request: AssistantRequest },
  messages: [Message.ReceivedAssistantTurn, Message.FailedAssistantTurn],
  execute: ({ requestId, request }) => {
    const tools = toolsFor(request);
    return generateReply(messagesFor(request), toolDefinitions(tools)).pipe(
      Effect.map((output) =>
        Message.ReceivedAssistantTurn({ requestId, turn: decodeTurn(request.page, tools, output) }),
      ),
      recoverWith(({ message }) => Message.FailedAssistantTurn({ requestId, message })),
    );
  },
});

export const TranscribeRecording = Command.define("TranscribeRecording", {
  args: { recordingId: Schema.Int },
  messages: [Message.ReceivedTranscript, Message.FailedTranscript],
  execute: ({ recordingId }) =>
    finishRecording.pipe(
      Effect.flatMap(transcribeSamples),
      Effect.map((text) => Message.ReceivedTranscript({ recordingId, text })),
      recoverWith(({ message }) => Message.FailedTranscript({ recordingId, message })),
    ),
});
