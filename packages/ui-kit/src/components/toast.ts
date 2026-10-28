import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";

export type ToastKind = "success" | "error";

export interface ToastView<Message> {
  readonly id: string;
  readonly kind: ToastKind;
  readonly message: string;
  readonly onDismiss: Message;
}

const kindClass = {
  success: "bg-alert-success text-alert-success-foreground border-alert-success-foreground",
  error: "bg-alert-error text-alert-error-foreground border-alert-error-foreground",
} satisfies Record<ToastKind, string>;

/** A polite live region that stacks toasts at the top of the viewport. */
export function toastRegion<Message>(
  toasts: readonly ToastView<Message>[],
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [
      h.Role("status"),
      h.AriaLive("polite"),
      h.Class(
        "pointer-events-none fixed inset-x-0 top-4 z-50 grid justify-items-center gap-2 px-4",
      ),
    ],
    toasts.map((toast) =>
      h.keyed("div")(
        toast.id,
        [
          h.Class(
            cn(
              "pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded border-2 px-4 py-3 shadow-md",
              kindClass[toast.kind],
            ),
          ),
        ],
        [
          h.span([], [toast.message]),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel("Dismiss"),
              h.OnClick(toast.onDismiss),
              h.Class("font-head"),
            ],
            ["×"],
          ),
        ],
      ),
    ),
  );
}
