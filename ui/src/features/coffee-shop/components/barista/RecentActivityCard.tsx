import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { formatOrderTime, formatPrice } from "#features/coffee-shop/lib/coffee.ts";
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
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-card">
        <Text as="h3">Recent activity</Text>
      </Card.Header>
      <Card.Content className="grid gap-3">
        {orders.map((order) => (
          <button
            key={order.id}
            className="grid gap-2 border-2 border-border bg-background p-3 text-left shadow-xs transition hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-sm"
            type="button"
            onClick={() => onInspect(order.id)}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Text as="h4">{order.customerName}</Text>
              <StatusBadge status={order.status} />
            </div>
            <Text as="p" className="text-sm text-muted-foreground">
              {order.drinkName} · {formatPrice(order.priceCents)} · {formatOrderTime(order.createdAt)}
            </Text>
          </button>
        ))}
      </Card.Content>
    </Card>
  );
}
