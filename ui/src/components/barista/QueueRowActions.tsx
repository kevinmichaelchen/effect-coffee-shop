import { Button } from "#components/retroui/Button";
import { getOrderActions } from "#lib/coffee";
import type { CoffeeOrder, OrderAction } from "#lib/coffee";

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
