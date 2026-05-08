import { Button } from "#shared/ui/retroui/Button.tsx";
import { getOrderActions } from "#features/coffee-shop/lib/coffee.ts";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

interface QueueRowActionsProps {
  order: CoffeeOrder;
  pending: boolean;
  onAction: (orderId: string, action: OrderAction) => void;
}

export function QueueRowActions({ order, pending, onAction }: QueueRowActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {getOrderActions(order.status).map((option) => (
        <Button
          key={option.action}
          size="sm"
          variant={option.action === "cancel" ? "outline" : "default"}
          onClick={() => onAction(order.id, option.action)}
          disabled={pending}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
