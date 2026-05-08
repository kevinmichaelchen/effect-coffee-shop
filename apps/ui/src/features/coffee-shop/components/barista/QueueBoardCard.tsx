import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { QueueTable } from "#features/coffee-shop/components/barista/QueueTable.tsx";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

interface QueueBoardCardProps {
  orders: readonly CoffeeOrder[];
  pendingOrderId: string | null;
  onAction: (orderId: string, action: OrderAction) => void;
  onInspect: (orderId: string) => void;
}

export function QueueBoardCard(inputProps: QueueBoardCardProps) {
  const { orders, pendingOrderId, onAction, onInspect } = inputProps;

  return (
    <Card className="w-full">
      <Card.Header className="border-b border-border">
        <Text as="h3">Barista queue</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Move active tickets through the line.
        </Text>
      </Card.Header>
      <Card.Content>
        {orders.length === 0 ? (
          <Alert className="border-border bg-card" status="info">
            <Alert.Title>No active tickets</Alert.Title>
            <Alert.Description>
              Fresh orders will appear here as soon as they are placed.
            </Alert.Description>
          </Alert>
        ) : (
          <QueueTable
            orders={orders}
            pendingOrderId={pendingOrderId}
            onAction={onAction}
            onInspect={onInspect}
          />
        )}
      </Card.Content>
    </Card>
  );
}
