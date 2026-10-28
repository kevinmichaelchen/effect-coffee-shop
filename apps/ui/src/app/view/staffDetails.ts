import { Dialog } from "@foldkit/ui";
import { Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { overlay } from "@effect-coffee-shop/ui-kit/components/overlay";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { formatOrderTime, formatPrice, getOrderActions } from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems, getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import { statusBadge } from "#app/view/shared.ts";

type Builder = HtmlBuilder<Message>;

const detailLine = (label: string, value: string, h: Builder) =>
  h.div(
    [h.Class("grid gap-1 border-b border-border pb-3")],
    [text({ className: "text-sm text-muted-foreground" }, [label], h), text({}, [value], h)],
  );

function drawerContent(model: Model, order: OrderTicket, info: Dialog.RenderInfo, h: Builder) {
  return {
    title: getOrderTitle(order),
    description: `Ticket ${order.id}`,
    body: [
      ...Option.match(model.detailsError, {
        onNone: () => [],
        onSome: (message) => [
          alert({ status: "error", title: "Could not update the order" }, [message], h),
        ],
      }),
      statusBadge(order.status, h),
      detailLine("Customer", order.customerName, h),
      detailLine("Opened", formatOrderTime(order.createdAt), h),
      detailLine("Items", formatOrderItems(order), h),
      detailLine("Total", formatPrice(order.totalPriceCents), h),
    ],
    footer: [
      ...getOrderActions(order.status).map((option) =>
        button(
          {
            attributes: [
              h.OnClick(Message.ClickedOrderAction({ orderId: order.id, action: option.action })),
            ],
            disabled: Option.contains(model.pendingOrderId, order.id),
            variant: option.action === "cancel" ? "ghost" : "default",
          },
          [option.label],
          h,
        ),
      ),
      button({ attributes: [...info.closeButton], variant: "ghost" }, ["Close"], h),
    ],
  };
}

export function detailsDrawer(model: Model, h: Builder) {
  const selected = Option.flatMap(model.selectedOrderId, (id) =>
    Option.fromNullishOr(model.orders.find((order) => order.id === id)),
  );
  return h.submodel({
    slotId: model.detailsDialog.id,
    model: model.detailsDialog,
    view: Dialog.view,
    viewInputs: {
      hasDescription: Option.isSome(selected),
      toView: (info: Dialog.RenderInfo) =>
        overlay(
          "right",
          info,
          Option.match(selected, {
            onNone: () => ({
              title: "Order details",
              body: [],
              footer: [
                button({ attributes: [...info.closeButton], variant: "ghost" }, ["Close"], h),
              ],
            }),
            onSome: (order) => drawerContent(model, order, info, h),
          }),
          h,
        ),
    },
    toParentMessage: (message) => Message.GotDetailsDialogMessage({ message }),
  });
}
