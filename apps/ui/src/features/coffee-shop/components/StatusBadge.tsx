import { Badge } from "@effect-coffee-shop/ui-kit/components/retroui/Badge";
import type { ComponentProps } from "react";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";
import type { OrderStatus } from "#features/coffee-shop/lib/coffee.ts";

const badgeVariants: Record<OrderStatus, ComponentProps<typeof Badge>["variant"]> = {
  pending: "default",
  brewing: "warning",
  ready: "success",
  "picked-up": "primary",
  cancelled: "danger",
};

export interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <Badge size="pill" variant={badgeVariants[status]}>
      {getStatusLabel(status)}
    </Badge>
  );
}
