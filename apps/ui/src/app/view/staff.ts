import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { card, cardContent, cardTitleHeader } from "@effect-coffee-shop/ui-kit/components/card";
import { table, tableCell, tableHead, tableRow } from "@effect-coffee-shop/ui-kit/components/table";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import {
  formatOrderTime,
  formatPrice,
  getOrderActions,
  isActiveOrder,
} from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems, getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { detailsDrawer } from "#app/view/staffDetails.ts";
import { statusBadge } from "#app/view/shared.ts";

type Builder = HtmlBuilder<Message>;

const recentLimit = 6;

export const staffSnapshot = (model: Model) => {
  const active = model.orders.filter(isActiveOrder);
  return {
    active,
    history: model.orders.filter((order) => !isActiveOrder(order)).reverse(),
    ready: active.filter((order) => order.status === "ready").length,
  };
};

function rowActions(order: OrderTicket, pendingOrderId: Option.Option<string>, h: Builder) {
  const isPending = Option.contains(pendingOrderId, order.id);
  return h.div(
    [h.Class("flex flex-wrap gap-2")],
    getOrderActions(order.status).map((option) =>
      button(
        {
          attributes: [
            h.OnClick(Message.ClickedOrderAction({ orderId: order.id, action: option.action })),
          ],
          disabled: isPending,
          size: "sm",
          variant: option.action === "cancel" ? "ghost" : "outline",
        },
        [option.label],
        h,
      ),
    ),
  );
}

function queueTable(model: Model, orders: readonly OrderTicket[], h: Builder) {
  return table(
    ["Ticket", "Drink", "Customer", "Status", "Opened", "Actions"].map((label) =>
      tableHead(label, h),
    ),
    orders.map((order) =>
      tableRow(
        order.id,
        [
          tableCell({ className: "font-medium" }, [order.id], h),
          tableCell({ attributes: [h.Title(formatOrderItems(order))] }, [getOrderTitle(order)], h),
          tableCell({}, [order.customerName], h),
          tableCell({}, [statusBadge(order.status, h)], h),
          tableCell({}, [formatOrderTime(order.createdAt)], h),
          tableCell(
            { className: "space-y-2" },
            [
              rowActions(order, model.pendingOrderId, h),
              button(
                {
                  attributes: [h.OnClick(Message.ClickedInspectOrder({ orderId: order.id }))],
                  size: "sm",
                  variant: "ghost",
                },
                ["Details"],
                h,
              ),
            ],
            h,
          ),
        ],
        h,
      ),
    ),
    h,
  );
}

function queueBoard(model: Model, orders: readonly OrderTicket[], h: Builder) {
  return card(
    { className: "w-full" },
    [
      cardTitleHeader("Barista queue", "Move active tickets through the line.", h),
      cardContent(
        {},
        [
          orders.length === 0
            ? alert(
                { status: "info", surface: "card", title: "No active tickets" },
                ["Fresh orders will appear here as soon as they are placed."],
                h,
              )
            : queueTable(model, orders, h),
        ],
        h,
      ),
    ],
    h,
  );
}

function recentActivity(orders: readonly OrderTicket[], h: Builder) {
  return orders.length === 0
    ? h.empty
    : card(
        { className: "w-full" },
        [
          cardTitleHeader("Recent activity", undefined, h),
          cardContent(
            { className: "grid gap-3" },
            orders.map((order) =>
              h.keyed("button")(
                order.id,
                [
                  h.Type("button"),
                  h.OnClick(Message.ClickedInspectOrder({ orderId: order.id })),
                  h.Class(
                    "grid gap-2 rounded-md border border-border bg-background p-3 text-left transition hover:bg-muted/50",
                  ),
                ],
                [
                  h.div(
                    [h.Class("flex flex-wrap items-center justify-between gap-3")],
                    [text({ as: "h4" }, [order.customerName], h), statusBadge(order.status, h)],
                  ),
                  text(
                    { className: "text-sm text-muted-foreground" },
                    [
                      `${formatOrderItems(order)} · ${formatPrice(order.totalPriceCents)} · ${formatOrderTime(order.createdAt)}`,
                    ],
                    h,
                  ),
                ],
              ),
            ),
            h,
          ),
        ],
        h,
      );
}

export function staffQueue(model: Model, h: Builder) {
  const { active, history } = staffSnapshot(model);
  return h.section(
    [h.Class("grid gap-5")],
    [
      queueBoard(model, active, h),
      recentActivity(history.slice(0, recentLimit), h),
      detailsDrawer(model, h),
    ],
  );
}

export const staffAccessWarning = (h: Builder) =>
  alert(
    { status: "warning", title: "Staff access required" },
    ["This account can place orders, but it is not on the staff allowlist for queue actions."],
    h,
  );
