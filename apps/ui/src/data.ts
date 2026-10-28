import { Schema } from "effect";
import { AsyncData } from "foldkit";
import { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { DrinkSelection } from "@effect-coffee-shop/coffee-domain/Menu/OrderItem";

export { CoffeeOrder, DrinkSelection };
export const Viewer = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("anonymous") }),
  Schema.Struct({
    kind: Schema.Literals(["customer", "staff"]),
    userId: Schema.String,
    displayName: Schema.String,
  }),
]);
export type Viewer = typeof Viewer.Type;
export const Orders = Schema.Array(CoffeeOrder);
export const OrdersData = AsyncData.Schema(Orders, Schema.String);
export const ViewerData = AsyncData.Schema(Viewer, Schema.String);
export const OrderAction = Schema.Literals(["start-brewing", "mark-ready", "pick-up", "cancel"]);
export type OrderAction = typeof OrderAction.Type;
export const AuthAction = Schema.Literals(["register", "sign-in", "sign-out"]);
export const Draft = Schema.Struct({
  drinkId: Schema.String,
  size: Schema.String,
  milk: Schema.String,
  temperature: Schema.String,
  shots: Schema.String,
  quantity: Schema.String,
  notes: Schema.String,
});
export type Draft = typeof Draft.Type;
export const draft: Draft = {
  drinkId: "latte",
  size: "medium",
  milk: "whole",
  temperature: "hot",
  shots: "1",
  quantity: "1",
  notes: "",
};
export const DraftField = Schema.Literals([
  "size",
  "milk",
  "temperature",
  "shots",
  "quantity",
  "notes",
]);
export const DraftInput = Schema.Struct({
  ...DrinkSelection.fields,
  shots: Schema.FiniteFromString,
  quantity: Schema.FiniteFromString,
});
