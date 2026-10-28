import { Effect, Schedule, Schema } from "effect";
import { Command } from "foldkit";
import { load, pushUrl } from "foldkit/navigation";
import { ThemePreference, themeStorageKey } from "@effect-coffee-shop/ui-kit/components/theme";
import { authClient } from "#features/auth/auth-client.ts";
import { fetchViewer } from "#features/auth/api/viewer.ts";
import { createOrder, fetchMenu, updateOrderStatus } from "#features/coffee-shop/api/coffee.ts";
import { PlaceOrderRequest } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AuthAction } from "#app/model.ts";
import { Message, OrderActionName } from "#app/message.ts";

const unreachable = "Unable to reach the coffee shop. Check your connection and try again.";

/**
 * Turns an Effect's typed failure (every failure carries a readable message)
 * and any defect into a failure Message, so a Command's error channel is empty.
 */
const recoverWith =
  <Failed>(onFailure: (fields: { readonly message: string }) => Failed) =>
  <Success, Failure extends { readonly message: string }>(
    effect: Effect.Effect<Success, Failure>,
  ): Effect.Effect<Success | Failed> =>
    effect.pipe(
      Effect.catch((error) => Effect.succeed(onFailure({ message: error.message }))),
      Effect.catchCause(() => Effect.succeed(onFailure({ message: unreachable }))),
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
  execute: fetchMenu.pipe(
    Effect.retry(Schedule.exponential("250 millis").pipe(Schedule.upTo({ times: 2 }))),
    Effect.map((menu) => Message.SucceededFetchMenu({ menu })),
    recoverWith(Message.FailedFetchMenu),
  ),
});

export const PlaceOrder = Command.define("PlaceOrder", {
  args: { request: PlaceOrderRequest },
  messages: [Message.SucceededPlaceOrder, Message.FailedPlaceOrder],
  execute: ({ request }) =>
    createOrder(request).pipe(
      Effect.map((order) => Message.SucceededPlaceOrder({ order })),
      recoverWith(Message.FailedPlaceOrder),
    ),
});

export const RunOrderAction = Command.define("RunOrderAction", {
  args: { orderId: Schema.String, action: OrderActionName },
  messages: [Message.SucceededOrderAction, Message.FailedOrderAction],
  execute: ({ orderId, action }) =>
    updateOrderStatus(orderId, action).pipe(
      Effect.map((order) => Message.SucceededOrderAction({ order })),
      recoverWith(Message.FailedOrderAction),
    ),
});

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

export const ExpireToast = Command.define("ExpireToast", {
  args: { id: Schema.String },
  messages: [Message.ExpiredToast],
  execute: ({ id }) => Effect.sleep("4 seconds").pipe(Effect.as(Message.ExpiredToast({ id }))),
});
