import type { HtmlBuilder } from "foldkit/html";
import { button } from "@effect-coffee-shop/ui-kit/components/button";
import { card, cardContent } from "@effect-coffee-shop/ui-kit/components/card";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import type { Composer } from "#app/draft.ts";
import { Message } from "#app/message.ts";
import type { Model } from "#app/model.ts";

type Builder = HtmlBuilder<Message>;

export function orderPreview(model: Model, composer: Composer, h: Builder) {
  const { draft, item, priceCents } = composer;
  return card(
    { surface: "background" },
    [
      cardContent(
        { className: "grid gap-4 p-4" },
        [
          h.div(
            [h.Class("grid gap-2")],
            [
              text({ className: "text-xs text-muted-foreground" }, ["Summary"], h),
              text({ as: "h3", className: "text-xl font-semibold" }, [item.name], h),
              text(
                { className: "text-sm text-muted-foreground" },
                [
                  `${draft.quantity}x, ${draft.size}, ${draft.temperature}, ${draft.milk} milk, ${draft.shots} shot(s)`,
                ],
                h,
              ),
            ],
          ),
          text({ as: "h2", className: "text-3xl font-semibold" }, [formatPrice(priceCents)], h),
          button(
            {
              attributes: [h.OnClick(Message.ClickedSendOrder())],
              className: "justify-center",
              disabled: model.isPlacingOrder,
            },
            [model.isPlacingOrder ? "Sending order…" : "Send to queue"],
            h,
          ),
        ],
        h,
      ),
    ],
    h,
  );
}
