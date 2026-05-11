import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { formatOrderTime, formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems } from "#features/coffee-shop/lib/order-display.ts";
import type { CoffeeOrder } from "#features/coffee-shop/lib/coffee.ts";

interface RecentActivityCardProps {
  orders: readonly CoffeeOrder[];
  onInspect: (orderId: string) => void;
}

export function RecentActivityCard({ orders, onInspect }: RecentActivityCardProps) {
  if (orders.length === 0) {
    return null;
  }

  return (
    <Card className="w-full">
      <Card.Header className="border-b border-border">
        <Text as="h3">Recent activity</Text>
      </Card.Header>
      <Card.Content className="grid gap-3">
        {orders.map((order) => (
          <button
            key={order.id}
            className="grid gap-2 rounded-md border border-border bg-background p-3 text-left transition hover:bg-muted/50"
            type="button"
            onClick={() => onInspect(order.id)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text as="h4">{order.customerName}</Text>
              <StatusBadge status={order.status} />
            </div>
            <Text as="p" className="text-sm text-muted-foreground">
              {formatOrderItems(order)} · {formatPrice(order.totalPriceCents)} ·{" "}
              {formatOrderTime(order.createdAt)}
            </Text>
          </button>
        ))}
      </Card.Content>
    </Card>
  );
}
