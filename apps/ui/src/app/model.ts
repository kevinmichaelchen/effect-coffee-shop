import { Dialog, Toast as UiToast } from "@foldkit/ui";
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Option, Schema } from "effect";
import * as AsyncData from "foldkit/asyncData";
import { ThemePreference } from "@effect-coffee-shop/ui-kit/components/theme";
import { AssistantState } from "#features/assistant/lib/state.ts";
import { Viewer, anonymousViewer } from "#features/auth/lib/viewer.ts";
import {
  MenuItem,
  OrderDraft,
  OrderTicket,
  PlaceOrderRequest,
} from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AppRoute } from "#app/route.ts";

export const AuthAction = Schema.Literals(["create-account", "sign-in", "sign-out"]);
export type AuthAction = typeof AuthAction.Type;

export const OrderActionName = Schema.Literals([
  "start-brewing",
  "mark-ready",
  "pick-up",
  "cancel",
]);
export type OrderActionName = typeof OrderActionName.Type;

const CopyState = Schema.Literals(["idle", "copied", "failed"]);

/** What one of the app's toasts says; the Foldkit Toast owns its lifecycle. */
const ToastPayload = Schema.Struct({
  kind: Schema.Literals(["success", "error"]),
  message: Schema.String,
});

/** The toast stack, bound to the app's payload. */
export const Toast = UiToast.make(ToastPayload);

/** The remote reads the page shows, each with its own load and failure state. */
export const ViewerData = AsyncData.Schema(Viewer, Schema.String);
export const MenuData = AsyncData.Schema(Schema.Array(MenuItem), Schema.String);
export const OrdersData = AsyncData.Schema(Schema.Array(OrderTicket), Schema.String);

/** A ticket being placed, with the ids an uncertain send must be retried with. */
const PendingOrder = Schema.Struct({
  commandId: Schema.String,
  /** Absent until `StartOrder` has made the ticket id. */
  orderId: Schema.Option(Schema.String),
  request: PlaceOrderRequest,
});

/**
 * The staff action sent last, kept while its outcome is unknown: its retry
 * repeats the same command instead of moving the ticket twice.
 */
const OrderActionAttempt = Schema.Struct({
  commandId: Schema.String,
  orderId: Schema.String,
  action: OrderActionName,
});

export const Model = Schema.Struct({
  route: AppRoute,
  theme: ThemePreference,
  viewer: ViewerData.schema,
  displayName: Schema.String,
  pendingAuth: Schema.Option(AuthAction),
  authError: Schema.Option(Schema.String),
  menu: MenuData.schema,
  orders: OrdersData.schema,
  draft: Schema.Option(OrderDraft),
  /** Page-local command ids, so every send can be repeated without repeating its write. */
  commandIds: DomainFoldkit.CommandIds,
  isPlacingOrder: Schema.Boolean,
  pendingOrder: Schema.Option(PendingOrder),
  receipt: Schema.Option(OrderTicket),
  receiptDialog: Dialog.Model,
  selectedOrderId: Schema.Option(Schema.String),
  pendingOrderId: Schema.Option(Schema.String),
  orderActionAttempt: Schema.Option(OrderActionAttempt),
  detailsDialog: Dialog.Model,
  detailsError: Schema.Option(Schema.String),
  copyState: CopyState,
  menuDialog: Dialog.Model,
  toast: Toast.Model,
  assistant: AssistantState,
});
export type Model = typeof Model.Type;

/** Who the page acts for: the last read account, or the visitor until one arrives. */
export const viewerOf = (model: Model): Viewer =>
  AsyncData.getOrElse(model.viewer, () => anonymousViewer);

/** What the page can render of the menu: the last read, or nothing yet. */
export const menuOf = (model: Model): readonly MenuItem[] =>
  AsyncData.getOrElse(model.menu, () => []);

/** The tickets the current feed last sent; a failed refresh keeps them on screen. */
export const ordersOf = (model: Model): readonly OrderTicket[] =>
  AsyncData.getOrElse(model.orders, () => []);

/** Every read the page could not complete, for its warning banner. */
export const readErrors = (model: Model): ReadonlyArray<string> =>
  [
    AsyncData.getError(model.viewer),
    AsyncData.getError(model.menu),
    AsyncData.getError(model.orders),
  ].flatMap((error) => (Option.isSome(error) ? [error.value] : []));
