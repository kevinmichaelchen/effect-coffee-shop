import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { cn } from "#shared/lib/utils.ts";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";
import type { OrderStatus } from "#features/coffee-shop/lib/coffee.ts";

const badgeClasses: Record<OrderStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  brewing: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100",
  ready: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100",
  "picked-up": "bg-primary text-primary-foreground",
  cancelled: "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100",
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
