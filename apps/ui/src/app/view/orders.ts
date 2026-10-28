import type { HtmlBuilder } from "foldkit/html";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { card, cardContent, cardTitleHeader } from "@effect-coffee-shop/ui-kit/components/card";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { formatOrderTime, formatPrice, isActiveOrder } from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems, getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import type { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { statusBadge } from "#app/view/shared.ts";

type Builder = HtmlBuilder<Message>;

function orderRow(order: OrderTicket, h: Builder) {
  return h.keyed("div")(
    order.id,
    [h.Class("grid gap-2 rounded-md border border-border bg-background p-3")],
    [
      h.div(
        [h.Class("flex flex-wrap items-center justify-between gap-3")],
        [
          text({ as: "h4", className: "font-semibold" }, [getOrderTitle(order)], h),
          statusBadge(order.status, h),
        ],
      ),
      text(
        { className: "text-sm text-muted-foreground" },
        [
          `${order.id} · ${formatPrice(order.totalPriceCents)} · ${formatOrderTime(order.createdAt)}`,
        ],
        h,
      ),
      text({ className: "text-sm text-muted-foreground" }, [formatOrderItems(order)], h),
    ],
  );
}

function orderGroup(
  title: string,
  emptyMessage: string,
  orders: readonly OrderTicket[],
  h: Builder,
) {
  return h.section(
    [h.Class("grid gap-3")],
    [
      text({ className: "text-xs font-medium text-muted-foreground" }, [title], h),
      ...(orders.length === 0
        ? [alert({ status: "info", surface: "background", title: emptyMessage }, [], h)]
        : orders.map((order) => orderRow(order, h))),
    ],
  );
}

export function ordersCard(model: Model, h: Builder) {
  const active = model.orders.filter(isActiveOrder);
  const history = model.orders.filter((order) => !isActiveOrder(order)).reverse();
  return card(
    { className: "w-full" },
    [
      cardTitleHeader(
        "My tickets",
        model.isRefreshingOrders
          ? "Refreshing tickets..."
          : "Only your account-scoped tickets appear here.",
        h,
      ),
      cardContent(
        { className: "grid gap-5" },
        [
          orderGroup("Active", "No active tickets yet.", active, h),
          orderGroup("History", "Closed tickets land here.", history, h),
        ],
        h,
      ),
    ],
    h,
  );
}
