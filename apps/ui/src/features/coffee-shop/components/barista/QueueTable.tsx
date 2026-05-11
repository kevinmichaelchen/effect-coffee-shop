import { Button } from "#shared/ui/retroui/Button.tsx";
import { Table } from "#shared/ui/retroui/Table.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { QueueRowActions } from "#features/coffee-shop/components/barista/QueueRowActions.tsx";
import { formatOrderTime } from "#features/coffee-shop/lib/coffee.ts";
import { formatOrderItems, getOrderTitle } from "#features/coffee-shop/lib/order-display.ts";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

interface QueueTableProps {
  orders: readonly CoffeeOrder[];
  pendingOrderId: string | null;
  onAction: (orderId: string, action: OrderAction) => void;
  onInspect: (orderId: string) => void;
}

export function QueueTable(inputProps: QueueTableProps) {
  const { orders, pendingOrderId, onAction, onInspect } = inputProps;

  return (
    <Table className="bg-card">
      <Table.Header>
        <Table.Row>
          <Table.Head>Ticket</Table.Head>
          <Table.Head>Drink</Table.Head>
          <Table.Head>Customer</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head>Opened</Table.Head>
          <Table.Head>Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {orders.map((order) => (
          <Table.Row key={order.id}>
            <Table.Cell className="font-medium">{order.id}</Table.Cell>
            <Table.Cell title={formatOrderItems(order)}>{getOrderTitle(order)}</Table.Cell>
            <Table.Cell>{order.customerName}</Table.Cell>
            <Table.Cell>
              <StatusBadge status={order.status} />
            </Table.Cell>
            <Table.Cell>{formatOrderTime(order.createdAt)}</Table.Cell>
            <Table.Cell className="space-y-2">
              <QueueRowActions
                order={order}
                pending={pendingOrderId === order.id}
                onAction={onAction}
              />
              <Button size="sm" variant="ghost" onClick={() => onInspect(order.id)}>
                Details
              </Button>
            </Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table>
  );
}
