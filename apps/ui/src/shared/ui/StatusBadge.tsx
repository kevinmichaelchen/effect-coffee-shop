import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { cn } from "#shared/lib/utils.ts";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";
import type { OrderStatus } from "#features/coffee-shop/lib/coffee.ts";

const badgeClasses: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  brewing:
    "bg-status-brewing text-status-brewing-foreground dark:bg-status-brewing-foreground/40 dark:text-status-brewing",
  ready:
    "bg-status-ready text-status-ready-foreground dark:bg-status-ready-foreground/40 dark:text-status-ready",
  "picked-up": "bg-primary text-primary-foreground",
  cancelled:
    "bg-status-cancelled text-status-cancelled-foreground dark:bg-status-cancelled-foreground/40 dark:text-status-cancelled",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", badgeClasses[status])}
      size="sm"
    >
      {getStatusLabel(status)}
    </Badge>
  );
}
