import { AsyncData } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { CoffeeOrder } from "./data.ts";
import { button, dollars } from "./controls.ts";
export const ticket = (order: CoffeeOrder, model: Model, h: HtmlBuilder<Message>): Html =>
  h.keyed("article")(
    order.id,
    [h.Class("ticket")],
    [
      h.div(
        [h.Class("row")],
        [
          h.h3([], [order.customerName]),
          h.span([h.Class(`status ${order.status}`)], [order.status.replaceAll("_", " ")]),
        ],
      ),
      h.p([h.Class("muted")], [order.id]),
      ...order.items.map((item) =>
        h.p(
          [],
          [
            `${item.quantity} × ${item.drinkName} · ${item.size} · ${item.milk} · ${item.temperature}`,
          ],
        ),
      ),
      h.div(
        [h.Class("row")],
        [
          h.strong([], [dollars(order.totalPrice.minorUnits)]),
          button("Receipt", Message.SelectedReceipt({ order }), h),
        ],
      ),
      staffActions(order, model, h),
    ],
  );
export const orderList = (model: Model, h: HtmlBuilder<Message>) =>
  AsyncData.matchDataSplitEmpty(model.orders, {
    onIdle: () => h.p([], ["Connecting to your orders…"]),
    onLoading: () => h.p([], ["Loading orders…"]),
    onFailure: (error) => h.p([h.Role("alert")], [error]),
    onData: (orders) =>
      h.div(
        [h.Class("orders")],
        [
          h.h2([], [model.page === "staff" ? "The queue" : "Your orders"]),
          orders.length === 0
            ? h.p([h.Class("muted")], ["No tickets yet. Your next cup starts here."])
            : h.empty,
          ...orders.toReversed().map((order) => ticket(order, model, h)),
        ],
      ),
  });

const staffActions = (order: CoffeeOrder, model: Model, h: HtmlBuilder<Message>) => {
  if (model.page !== "staff") return h.empty;
  const actions = actionsFor(order.status);
  return h.div(
    [h.Class("actions")],
    actions.map(({ action, label }) =>
      button(label, Message.ClickedOrderAction({ orderId: order.id, action }), h, model.pending),
    ),
  );
};
const actionsFor = (
  status: CoffeeOrder["status"],
): ReadonlyArray<{ action: import("./data.ts").OrderAction; label: string }> => {
  switch (status) {
    case "pending":
      return [
        { action: "start-brewing", label: "Start brewing" },
        { action: "cancel", label: "Cancel" },
      ];
    case "brewing":
      return [
        { action: "mark-ready", label: "Mark ready" },
        { action: "cancel", label: "Cancel" },
      ];
    case "ready":
      return [{ action: "pick-up", label: "Picked up" }];
    default:
      return [];
  }
};
