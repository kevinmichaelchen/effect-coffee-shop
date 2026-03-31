import { Button } from "#components/retroui/Button";
import { Table } from "#components/retroui/Table";
import { StatusBadge } from "#components/shared/StatusBadge";
import { QueueRowActions } from "#components/barista/QueueRowActions";
import { formatOrderTime, formatPrice } from "#lib/coffee";
import type { CoffeeOrder, OrderAction } from "#lib/coffee";

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
          <Table.Head>Status</Table.Head>
          <Table.Head>Opened</Table.Head>
          <Table.Head>Total</Table.Head>
          <Table.Head>Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {orders.map((order) => (
          <Table.Row key={order.id}>
            <Table.Cell className="font-head">{order.id}</Table.Cell>
            <Table.Cell>{order.drinkName}</Table.Cell>
            <Table.Cell><StatusBadge status={order.status} /></Table.Cell>
            <Table.Cell>{formatOrderTime(order.createdAt)}</Table.Cell>
            <Table.Cell>{formatPrice(order.priceCents)}</Table.Cell>
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
