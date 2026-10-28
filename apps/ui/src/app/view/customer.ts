import { Dialog } from "@foldkit/ui";
import { Option } from "effect";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { overlay } from "@effect-coffee-shop/ui-kit/components/overlay";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { formatOrderTime, formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems } from "#features/coffee-shop/lib/order-display.ts";
import type { OrderTicket } from "#features/coffee-shop/lib/coffee.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";
import type { Builder } from "#app/view/builder.ts";
import { assistantCard } from "#app/view/assistant.ts";
import { composerCard } from "#app/view/composer.ts";
import { ordersCard } from "#app/view/orders.ts";
import { statusBadge } from "#app/view/shared.ts";

/** The composer and the customer's tickets, shown once someone is signed in. */
export function customerWorkspace(model: Model, h: Builder) {
  return h.div(
    [h.Class("grid gap-5")],
    [
      assistantCard(model, h),
      h.div(
        [h.Class("grid gap-5 xl:grid-cols-customer-workspace")],
        [composerCard(model, h), h.div([h.Id("my-orders")], [ordersCard(model, h)])],
      ),
    ],
  );
}

function receiptBody(order: OrderTicket, h: Builder) {
  return [
    h.div(
      [h.Class("flex flex-wrap items-center gap-3")],
      [
        statusBadge(order.status, h),
        text(
          { className: "text-sm text-muted-foreground" },
          [`Ticket ${order.id} opened at ${formatOrderTime(order.createdAt)}`],
          h,
        ),
      ],
    ),
    text({ as: "h3" }, [order.customerName], h),
    text({ className: "text-lg" }, [formatOrderItems(order)], h),
    text({ as: "h4", className: "text-2xl" }, [formatPrice(order.totalPriceCents)], h),
  ];
}

export function receiptDialog(model: Model, h: Builder) {
  return h.submodel({
    slotId: model.receiptDialog.id,
    model: model.receiptDialog,
    view: Dialog.view,
    viewInputs: {
      hasDescription: true,
      toView: (info: Dialog.RenderInfo) =>
        overlay(
          "center",
          info,
          {
            title: "Order sent to the queue",
            description: "Review the new ticket, then keep ordering or jump to active tickets.",
            body: Option.match(model.receipt, {
              onNone: () => [],
              onSome: (order) => receiptBody(order, h),
            }),
            footer: [
              button(
                { attributes: [...info.closeButton], variant: "outline" },
                ["Keep ordering"],
                h,
              ),
              button(
                { attributes: [h.OnClick(Message.ClickedOpenMyOrders())] },
                ["Open my orders"],
                h,
              ),
            ],
          },
          h,
        ),
    },
    toParentMessage: (message) => Message.GotReceiptDialogMessage({ message }),
  });
}
