import { alert } from "@effect-coffee-shop/ui-kit/components/alert";
import { badge, type BadgeVariant } from "@effect-coffee-shop/ui-kit/components/badge";
import { card, cardContent } from "@effect-coffee-shop/ui-kit/components/card";
import { progress } from "@effect-coffee-shop/ui-kit/components/progress";
import { text } from "@effect-coffee-shop/ui-kit/components/text";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";
import type { OrderStatus } from "#features/coffee-shop/lib/coffee.ts";
import type { Builder } from "#app/view/builder.ts";

const badgeVariants = {
  pending: "default",
  brewing: "warning",
  ready: "success",
  "picked-up": "primary",
  cancelled: "danger",
} satisfies Record<OrderStatus, BadgeVariant>;

export const statusBadge = (status: OrderStatus, h: Builder) =>
  badge({ size: "pill", variant: badgeVariants[status] }, [getStatusLabel(status)], h);

export interface Metric {
  readonly label: string;
  readonly value: string;
  readonly progress?: number;
}

export function metricStrip(metrics: readonly Metric[], h: Builder) {
  return card(
    {},
    [
      cardContent(
        { className: "flex flex-wrap gap-5 p-4" },
        metrics.map((metric) =>
          h.div(
            [h.Class("grid min-w-20 gap-1")],
            [
              text({ className: "text-xs text-muted-foreground" }, [metric.label], h),
              text({ className: "text-2xl font-semibold" }, [metric.value], h),
              ...(metric.progress === undefined ? [] : [progress(metric.progress, h)]),
            ],
          ),
        ),
        h,
      ),
    ],
    h,
  );
}

export const workspaceWarning = (message: string, h: Builder) =>
  alert({ status: "warning", title: "Workspace warning" }, [message], h);
