import { Badge } from "#components/retroui/Badge";
import { cn } from "#lib/utils";
import { getStatusLabel } from "#lib/coffee";
import type { OrderStatus } from "#lib/coffee";

const badgeClasses: Record<OrderStatus, string> = {
  pending: "bg-yellow-300 text-yellow-900",
  brewing: "bg-sky-300 text-sky-950",
  ready: "bg-green-300 text-green-900",
  "picked-up": "bg-black text-white",
  cancelled: "bg-rose-300 text-rose-900",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge
      className={cn("rounded-none px-2.5 py-1 uppercase tracking-[0.08em]", badgeClasses[status])}
      size="sm"
    >
      {getStatusLabel(status)}
    </Badge>
  );
}
