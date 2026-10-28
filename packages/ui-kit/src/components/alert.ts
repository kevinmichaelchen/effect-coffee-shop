import { cva, type VariantProps } from "class-variance-authority";
import type { HtmlBuilder } from "foldkit/html";
import { cn } from "#ui/lib/utils.ts";
import type { Child } from "#ui/components/types.ts";
import { text } from "#ui/components/text.ts";

const alertVariants = cva("relative w-full rounded border-2 p-4", {
  variants: {
    status: {
      error: "bg-alert-error text-alert-error-foreground border-alert-error-foreground",
      success: "bg-alert-success text-alert-success-foreground border-alert-success-foreground",
      warning: "bg-alert-warning text-alert-warning-foreground border-alert-warning-foreground",
      info: "bg-alert-info text-alert-info-foreground border-alert-info-foreground",
    },
    surface: {
      status: "",
      card: "bg-card border-border",
      background: "bg-background border-border",
    },
  },
});

export type AlertStatus = NonNullable<VariantProps<typeof alertVariants>["status"]>;
export type AlertSurface = NonNullable<VariantProps<typeof alertVariants>["surface"]>;

export interface AlertProps {
  readonly status?: AlertStatus;
  readonly surface?: AlertSurface;
  readonly title: string;
}

/** An alert with a title and an optional description body. */
export function alert<Message>(
  props: AlertProps,
  description: readonly Child[],
  h: HtmlBuilder<Message>,
) {
  return h.div(
    [h.Role("alert"), h.Class(cn(alertVariants({ status: props.status, surface: props.surface })))],
    [
      text({ as: "h5" }, [props.title], h),
      ...(description.length === 0 ? [] : [h.div([h.Class("text-muted-foreground")], description)]),
    ],
  );
}
