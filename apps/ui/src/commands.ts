import { Effect, Layer, Schema } from "effect";
import { Command } from "foldkit";
import { load } from "foldkit/navigation";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { Message } from "./message.ts";
import { Draft, DraftInput, OrderAction, AuthAction } from "./data.ts";
import * as Api from "./api.ts";
import * as Auth from "./auth.ts";
const layer = Layer.merge(Api.apiLayer, Auth.authLayer);
export const FetchViewer = Command.define("FetchViewer", {
  args: {},
  messages: [Message.LoadedViewer, Message.FailedRequest],
  execute: () =>
    Api.viewer.pipe(
      Effect.map((viewer) => Message.LoadedViewer({ viewer })),
      Effect.provide(layer),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedRequest({ error: "Unable to load your session. Please retry." }),
        ),
      ),
    ),
});
export const Authenticate = Command.define("Authenticate", {
  args: { action: AuthAction, displayName: Schema.String, mcp: Schema.Boolean },
  messages: [Message.CompletedAuth, Message.FailedRequest],
  execute: ({ action, displayName, mcp }) =>
    Effect.gen(function* () {
      if (action === "register") yield* Auth.register(displayName);
      else if (action === "sign-in") yield* Auth.signIn;
      else yield* Auth.signOut;
      const viewer = yield* Api.viewer;
      if (mcp && viewer.kind !== "anonymous") yield* load("/oauth/coffee/authorize");
      return Message.CompletedAuth({ viewer });
    }).pipe(
      Effect.provide(layer),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedRequest({
            error: "Authentication did not complete. Check your name and try your passkey again.",
          }),
        ),
      ),
    ),
});
export const PlaceOrder = Command.define("PlaceOrder", {
  args: { draft: Draft },
  messages: [Message.PlacedOrder, Message.FailedRequest],
  execute: ({ draft }) =>
    Schema.decodeEffect(DraftInput)(draft).pipe(
      Effect.flatMap((item) => Api.placeOrder([item])),
      Effect.map((order) => Message.PlacedOrder({ order })),
      Effect.provide(layer),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedRequest({
            error: "Unable to place this order. Check the drink options and try again.",
          }),
        ),
      ),
    ),
});
export const ChangeOrder = Command.define("ChangeOrder", {
  args: { orderId: OrderId, action: OrderAction },
  messages: [Message.ChangedOrder, Message.FailedRequest],
  execute: ({ orderId, action }) =>
    Api.changeOrder(orderId, action).pipe(
      Effect.map((order) => Message.ChangedOrder({ order })),
      Effect.provide(layer),
      Effect.catch(() =>
        Effect.succeed(
          Message.FailedRequest({
            error: "Unable to update this ticket. It may have changed; refresh and try again.",
          }),
        ),
      ),
    ),
});
export const SaveTheme = Command.define("SaveTheme", {
  args: { theme: Schema.Literals(["light", "dark"]) },
  messages: [Message.SavedTheme],
  execute: ({ theme }) =>
    Effect.sync(() => {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("coffee-theme", theme);
      return Message.SavedTheme();
    }),
});
