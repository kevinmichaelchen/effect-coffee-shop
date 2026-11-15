import { Dialog } from "@foldkit/ui";
import * as DomainFoldkit from "@alchemy.run/domain/Foldkit";
import { Schema } from "effect";
import { ThemePreference } from "@effect-coffee-shop/ui-kit/components/theme";
import { AssistantState } from "#features/assistant/lib/state.ts";
import { Viewer } from "#features/auth/lib/viewer.ts";
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

const Toast = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["success", "error"]),
  message: Schema.String,
});
export type Toast = typeof Toast.Type;

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
  viewer: Viewer,
  viewerError: Schema.Option(Schema.String),
  displayName: Schema.String,
  pendingAuth: Schema.Option(AuthAction),
  authError: Schema.Option(Schema.String),
  menu: Schema.Array(MenuItem),
  menuError: Schema.Option(Schema.String),
  orders: Schema.Array(OrderTicket),
  ordersError: Schema.Option(Schema.String),
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
  toasts: Schema.Array(Toast),
  toastCount: Schema.Int,
  assistant: AssistantState,
});
export type Model = typeof Model.Type;
