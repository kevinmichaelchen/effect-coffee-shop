import { Dialog } from "@foldkit/ui";
import { FeedId } from "@effect-coffee-shop/coffee-domain/Order/OrderFeed";
import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { Url } from "foldkit/url";
import { Viewer } from "#features/auth/lib/viewer.ts";
import { MenuItem, OrderTicket } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AuthAction } from "#app/model.ts";

export const OrderActionName = Schema.Literals([
  "start-brewing",
  "mark-ready",
  "pick-up",
  "cancel",
]);

export const Message = defineMessageUnion({
  // Navigation
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedNavigateInternal: {},
  CompletedLoadExternal: {},
  // Theme
  ClickedToggleTheme: {},
  CompletedApplyTheme: {},
  // Viewer
  SucceededFetchViewer: { viewer: Viewer },
  FailedFetchViewer: { message: Schema.String },
  // Passkey auth
  ChangedDisplayName: { value: Schema.String },
  ClickedCreateAccount: {},
  ClickedSignIn: {},
  ClickedSignOut: {},
  SucceededAuth: { action: AuthAction },
  FailedAuth: { message: Schema.String },
  // Menu and orders
  SucceededFetchMenu: { menu: Schema.Array(MenuItem) },
  FailedFetchMenu: { message: Schema.String },
  LoadedOrders: { feedId: FeedId, userId: Schema.String, orders: Schema.Array(OrderTicket) },
  FailedOrders: { feedId: FeedId, userId: Schema.String, message: Schema.String },
  // Order composer
  ClickedSelectDrink: { drinkId: Schema.String },
  ChangedDrinkSize: { value: Schema.String },
  ChangedMilk: { value: Schema.String },
  ChangedTemperature: { value: Schema.String },
  ChangedShots: { value: Schema.String },
  ChangedQuantity: { value: Schema.String },
  ChangedNotes: { value: Schema.String },
  ClickedSendOrder: {},
  SucceededPlaceOrder: { order: OrderTicket },
  FailedPlaceOrder: { message: Schema.String },
  // Receipt
  ClickedOpenMyOrders: {},
  CompletedScrollToOrders: {},
  GotReceiptDialogMessage: { message: Dialog.Message },
  // Staff queue
  ClickedInspectOrder: { orderId: Schema.String },
  ClickedOrderAction: { orderId: Schema.String, action: OrderActionName },
  SucceededOrderAction: { order: OrderTicket },
  FailedOrderAction: { message: Schema.String },
  GotDetailsDialogMessage: { message: Dialog.Message },
  // Session card
  ClickedCopyUserId: {},
  SucceededCopyUserId: {},
  FailedCopyUserId: {},
  // Mobile navigation drawer
  ClickedOpenMenu: {},
  GotMenuDialogMessage: { message: Dialog.Message },
  // Toasts
  DismissedToast: { id: Schema.String },
  ExpiredToast: { id: Schema.String },
});
export type Message = typeof Message.Type;
