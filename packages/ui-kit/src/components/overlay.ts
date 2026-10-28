import type { Dialog } from "@foldkit/ui";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Child } from "#ui/components/types.ts";

export type OverlayPlacement = "center" | "right";

export interface OverlayContent {
  readonly title: string;
  readonly description?: string;
  readonly body: readonly Child[];
  readonly footer: readonly Child[];
}

const panelPlacement = {
  center: "fixed inset-0 m-auto h-fit max-w-xl w-[calc(100%-2rem)] border-2 shadow-lg",
  right: "fixed inset-y-0 right-0 h-full w-[min(24rem,100%)] border-l-2",
} satisfies Record<OverlayPlacement, string>;

/**
 * Styles a `@foldkit/ui` Dialog as a centered modal or a right-hand drawer.
 * The Dialog Submodel owns focus trap, Escape, scroll lock and return focus.
 */
export function overlay<Message>(
  placement: OverlayPlacement,
  info: Dialog.RenderInfo,
  content: OverlayContent,
  h: HtmlBuilder<Message>,
) {
  return h.dialog(
    [...info.dialog],
    info.isVisible
      ? [
          h.div([...info.backdrop, h.Class("fixed inset-0 bg-black/50")]),
          h.div(
            [
              ...info.panel,
              h.Class(
                cn(
                  "flex flex-col gap-4 overflow-y-auto border-border bg-card text-card-foreground",
                  panelPlacement[placement],
                ),
              ),
            ],
            [
              h.div(
                [h.Class("border-b-2 border-border bg-primary px-4 py-3")],
                [h.h2([...info.title, h.Class("font-head text-xl")], [content.title])],
              ),
              ...(content.description === undefined
                ? []
                : [
                    h.p(
                      [...info.description, h.Class("px-4 text-sm text-muted-foreground")],
                      [content.description],
                    ),
                  ]),
              h.div([h.Class("grid gap-4 px-4")], content.body),
              h.div([h.Class("flex flex-wrap justify-end gap-3 px-4 pb-4")], content.footer),
            ],
          ),
        ]
      : [],
  );
}
