import { Alert } from "#components/retroui/Alert";
import { Card } from "#components/retroui/Card";
import { Text } from "#components/retroui/Text";
import { QueueTable } from "#components/barista/QueueTable";
import type { CoffeeOrder, OrderAction } from "#lib/coffee";

interface QueueBoardCardProps {
  orders: readonly CoffeeOrder[];
  pendingOrderId: string | null;
  onAction: (orderId: string, action: OrderAction) => void;
  onInspect: (orderId: string) => void;
}

export function QueueBoardCard(inputProps: QueueBoardCardProps) {
  const { orders, pendingOrderId, onAction, onInspect } = inputProps;

  return (
    <Card className="w-full border-border">
      <Card.Header className="border-b-2 border-border bg-card">
        <Text as="h3">Barista queue</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          Live ticket actions are mapped directly to the existing order transition endpoints.
        </Text>
      </Card.Header>
      <Card.Content>
        {orders.length === 0 ? (
          <Alert className="border-border bg-card" status="info">
            <Alert.Title>No active tickets</Alert.Title>
            <Alert.Description>Fresh orders will appear here as soon as they are placed.</Alert.Description>
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
