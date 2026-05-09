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

export function CustomerOrdersPanel(inputProps: CustomerOrdersPanelProps) {
  const { activeOrders, historyOrders, isRefreshing } = inputProps;

  return (
    <Card className="w-full">
      <Card.Header className="border-b border-border">
        <Text as="h3">My tickets</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          {isRefreshing ? "Refreshing tickets..." : "Only your account-scoped tickets appear here."}
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-5">
        <OrderGroup emptyMessage="No active tickets yet." orders={activeOrders} title="Active" />
        <OrderGroup
          emptyMessage="Closed tickets land here."
          orders={historyOrders}
          title="History"
        />
      </Card.Content>
    </Card>
  );
}

function OrderGroup(inputProps: OrderGroupProps) {
  const { emptyMessage, orders, title } = inputProps;

  return (
    <section className="grid gap-3">
      <Text as="p" className="text-xs font-medium text-muted-foreground">
        {title}
      </Text>
      {orders.length === 0 ? <EmptyOrders message={emptyMessage} /> : <OrderRows orders={orders} />}
    </section>
  );
}

interface OrderGroupProps {
  emptyMessage: string;
  orders: readonly CoffeeOrder[];
  title: string;
}

function EmptyOrders({ message }: { message: string }) {
  return (
    <Alert className="border-border bg-background" status="info">
      <Alert.Title>{message}</Alert.Title>
    </Alert>
  );
}

function OrderRows({ orders }: { orders: readonly CoffeeOrder[] }) {
  return orders.map((order) => <OrderRow key={order.id} order={order} />);
}

function OrderRow({ order }: { order: CoffeeOrder }) {
  return (
    <div className="grid gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Text as="h4" className="font-semibold">
          {order.drinkName}
        </Text>
        <StatusBadge status={order.status} />
      </div>
      <Text as="p" className="text-sm text-muted-foreground">
        {order.id} · {formatPrice(order.priceCents)} · {formatOrderTime(order.createdAt)}
      </Text>
    </div>
  );
}
