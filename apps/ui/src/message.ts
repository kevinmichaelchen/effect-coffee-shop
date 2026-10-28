import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { CoffeeOrder, Viewer, Orders, OrderAction, DraftField, AuthAction } from "./data.ts";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
export const Message = defineMessageUnion({
  LoadedViewer: { viewer: Viewer },
  FailedRequest: { error: Schema.String },
  LoadedOrders: { orders: Orders },
  ChangedName: { value: Schema.String },
  ClickedAuth: { action: AuthAction },
  CompletedAuth: { viewer: Viewer },
  SelectedDrink: { drinkId: Schema.String },
  ChangedDraft: { field: DraftField, value: Schema.String },
  SubmittedOrder: {},
  PlacedOrder: { order: CoffeeOrder },
  ClickedOrderAction: { orderId: OrderId, action: OrderAction },
  ChangedOrder: { order: CoffeeOrder },
  SelectedReceipt: { order: CoffeeOrder },
  DismissedReceipt: {},
  ClickedTheme: {},
  SavedTheme: {},
  ClickedRetry: {},
});
export type Message = typeof Message.Type;
