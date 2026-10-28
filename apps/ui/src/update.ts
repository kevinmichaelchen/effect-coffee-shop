import { Option } from "effect";
import { type Update } from "foldkit";
import { modifyFields } from "foldkit/struct";
import {
  findMenuItem,
  defaultMilkFor,
  defaultTemperatureFor,
  defaultShotsFor,
} from "@effect-coffee-shop/coffee-domain/Menu/Menu";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { OrdersData, ViewerData } from "./data.ts";
import * as Commands from "./commands.ts";

const loadedViewer = (
  model: Model,
  viewer: (typeof Message.LoadedViewer.Type)["viewer"],
): Update.Return<Model, Message> => {
  const next = modifyFields(model, {
    viewer: () => ViewerData.Success({ data: viewer }),
    feedEpoch: (value) => value + 1,
    orders: () => OrdersData.Idle(),
    pending: () => false,
    error: () => Option.none(),
    receipt: () => Option.none(),
  });
  return { model: next };
};
export const update = (model: Model, message: Message): Update.Return<Model, Message> =>
  Message.match(message, {
    LoadedViewer: ({ viewer }) => loadedViewer(model, viewer),
    CompletedAuth: ({ viewer }) => loadedViewer(model, viewer),
    FailedRequest: ({ error }) => ({
      model: modifyFields(model, { error: () => Option.some(error), pending: () => false }),
    }),
    LoadedOrders: ({ orders }) => ({
      model: modifyFields(model, { orders: () => OrdersData.Success({ data: orders }) }),
    }),
    ChangedName: ({ value }) => ({ model: modifyFields(model, { displayName: () => value }) }),
    ClickedAuth: ({ action }) => authenticate(model, action),
    SelectedDrink: ({ drinkId }) => selectDrink(model, drinkId),
    ChangedDraft: ({ field, value }) => ({
      model: modifyFields(model, { draft: (draft) => ({ ...draft, [field]: value }) }),
    }),
    SubmittedOrder: () => submitOrder(model),
    PlacedOrder: ({ order }) => ({
      model: modifyFields(model, { pending: () => false, receipt: () => Option.some(order) }),
    }),
    ClickedOrderAction: ({ orderId, action }) =>
      model.pending
        ? { model }
        : {
            model: modifyFields(model, { pending: () => true, error: () => Option.none() }),
            commands: [Commands.ChangeOrder({ orderId, action })],
          },
    ChangedOrder: () => ({
      model: modifyFields(model, { pending: () => false }),
    }),
    SelectedReceipt: ({ order }) => ({
      model: modifyFields(model, { receipt: () => Option.some(order) }),
    }),
    DismissedReceipt: () => ({ model: modifyFields(model, { receipt: () => Option.none() }) }),
    ClickedTheme: () => toggleTheme(model),
    SavedTheme: () => ({ model }),
    ClickedRetry: () => ({
      model: modifyFields(model, { error: () => Option.none() }),
      commands: [Commands.FetchViewer({})],
    }),
  });

const authenticate = (
  model: Model,
  action: (typeof Message.ClickedAuth.Type)["action"],
): Update.Return<Model, Message> =>
  model.pending
    ? { model }
    : {
        model: modifyFields(model, { pending: () => true, error: () => Option.none() }),
        commands: [
          Commands.Authenticate({
            action,
            displayName: model.displayName.trim(),
            mcp: model.page === "mcp",
          }),
        ],
      };

const selectDrink = (model: Model, drinkId: string) => ({
  model: modifyFields(model, {
    draft: (draft) =>
      Option.match(findMenuItem(drinkId), {
        onNone: () => draft,
        onSome: (item) => ({
          ...draft,
          drinkId,
          milk: defaultMilkFor(item),
          temperature: defaultTemperatureFor(item),
          shots: String(defaultShotsFor(item)),
        }),
      }),
  }),
});

const toggleTheme = (model: Model): Update.Return<Model, Message> => {
  const theme = model.theme === "light" ? "dark" : "light";
  return {
    model: modifyFields(model, { theme: () => theme }),
    commands: [Commands.SaveTheme({ theme })],
  };
};

const submitOrder = (model: Model): Update.Return<Model, Message> =>
  model.pending
    ? { model }
    : {
        model: modifyFields(model, { pending: () => true, error: () => Option.none() }),
        commands: [Commands.PlaceOrder({ draft: model.draft })],
      };
