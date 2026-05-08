import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { formatOrderTime, formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import type { CoffeeOrder } from "#features/coffee-shop/lib/coffee.ts";

interface CustomerOrdersPanelProps {
  activeOrders: readonly CoffeeOrder[];
  historyOrders: readonly CoffeeOrder[];
  isRefreshing: boolean;
}

function OrdersList(inputProps: {
  orders: readonly CoffeeOrder[];
  title: string;
  emptyMessage: string;
}) {
  const { emptyMessage, orders, title } = inputProps;

  return (
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-card">
        <Text as="h3">{title}</Text>
      </Card.Header>
      <Card.Content className="grid gap-3">
        {orders.length === 0 ? (
          <Alert className="border-border bg-card" status="info">
            <Alert.Title>{emptyMessage}</Alert.Title>
          </Alert>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="grid gap-2 border-2 border-border bg-background p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Text as="h4">{order.drinkName}</Text>
                <StatusBadge status={order.status} />
              </div>
              <Text as="p" className="text-sm text-muted-foreground">
                {order.id} · {formatPrice(order.priceCents)} · {formatOrderTime(order.createdAt)}
              </Text>
            </div>
          ))
        )}
      </Card.Content>
    </Card>
  );
}

export function CustomerOrdersPanel(inputProps: CustomerOrdersPanelProps) {
  const { activeOrders, historyOrders, isRefreshing } = inputProps;

  return (
    <section className="grid gap-6">
      <Card className="w-full border-border bg-primary text-primary-foreground">
        <Card.Content className="grid gap-2 p-4">
          <Text as="h3">My orders</Text>
          <Text as="p" className="text-sm text-primary-foreground/80">
            {isRefreshing ? "Refreshing your order list…" : "Only your tickets are visible here."}
          </Text>
        </Card.Content>
      </Card>
      <OrdersList
        emptyMessage="You do not have any active orders yet."
        orders={activeOrders}
        title="Active orders"
      />
      <OrdersList
        emptyMessage="Completed and cancelled orders will land here."
        orders={historyOrders}
        title="History"
      />
    </section>
  );
}
