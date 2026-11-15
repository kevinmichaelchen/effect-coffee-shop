import type { EntryHandlers } from "@foldkit/ui/toast";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";

export type ToastKind = "success" | "error";

const kindClass = {
  success: "bg-alert-success text-alert-success-foreground border-alert-success-foreground",
  error: "bg-alert-error text-alert-error-foreground border-alert-error-foreground",
} satisfies Record<ToastKind, string>;

/**
 * One entry of a `@foldkit/ui` Toast stack, styled for the kit. The Toast owns
 * its animation, timer and hover; `dismiss` goes on the close button.
 */
export function toastEntry<Message>(
  kind: ToastKind,
  message: string,
  dismiss: EntryHandlers["dismiss"],
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [
      h.Class(
        cn(
          "flex w-full items-center justify-between gap-3 rounded border-2 px-4 py-3 shadow-md",
          kindClass[kind],
        ),
      ),
    ],
    [
      h.span([], [message]),
      h.button([h.Type("button"), h.AriaLabel("Dismiss"), ...dismiss, h.Class("font-head")], ["×"]),
    ],
  );
}
