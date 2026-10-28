import { Dialog } from "@foldkit/ui";
import { Schema } from "effect";
import { ThemePreference } from "@effect-coffee-shop/ui-kit/components/theme";
import { Viewer } from "#features/auth/lib/viewer.ts";
import { MenuItem, OrderDraft, OrderTicket } from "#features/coffee-shop/lib/coffee-schemas.ts";
import { AppRoute } from "#app/route.ts";

export const AuthAction = Schema.Literals(["create-account", "sign-in", "sign-out"]);
export type AuthAction = typeof AuthAction.Type;

export const CopyState = Schema.Literals(["idle", "copied", "failed"]);

export const Toast = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(["success", "error"]),
  message: Schema.String,
});
export type Toast = typeof Toast.Type;

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
  isPlacingOrder: Schema.Boolean,
  receipt: Schema.Option(OrderTicket),
  receiptDialog: Dialog.Model,
  selectedOrderId: Schema.Option(Schema.String),
  pendingOrderId: Schema.Option(Schema.String),
  detailsDialog: Dialog.Model,
  detailsError: Schema.Option(Schema.String),
  copyState: CopyState,
  menuDialog: Dialog.Model,
  toasts: Schema.Array(Toast),
  toastCount: Schema.Int,
});
export type Model = typeof Model.Type;
