import { Button } from "#shared/ui/retroui/Button.tsx";
import { Drawer } from "#shared/ui/retroui/Drawer.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { formatOrderTime, formatPrice, getOrderActions } from "#features/coffee-shop/lib/coffee.ts";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

interface OrderDetailsDrawerProps {
  order: CoffeeOrder | null;
  pending: boolean;
  onAction: (orderId: string, action: OrderAction) => void;
  onOpenChange: (open: boolean) => void;
}

export function OrderDetailsDrawer(inputProps: OrderDetailsDrawerProps) {
  const { order, pending, onAction, onOpenChange } = inputProps;

  return (
    <Drawer open={order !== null} direction="right" onOpenChange={onOpenChange}>
      {order !== null ? (
        <Drawer.Content className="border-l border-border">
          <Drawer.Header>
            <Drawer.Title>{order.drinkName}</Drawer.Title>
            <Drawer.Description>Ticket {order.id}</Drawer.Description>
          </Drawer.Header>
          <div className="grid gap-4 px-4 pb-4">
            <StatusBadge status={order.status} />
            <DetailLine label="Customer" value={order.customerName} />
            <DetailLine label="Opened" value={formatOrderTime(order.createdAt)} />
            <DetailLine
              label="Build"
              value={`${order.size} · ${order.temperature} · ${order.milk}`}
            />
            <DetailLine label="Shots" value={String(order.shots)} />
            <DetailLine label="Total" value={formatPrice(order.priceCents)} />
            {order.notes !== undefined ? <DetailLine label="Notes" value={order.notes} /> : null}
          </div>
          <Drawer.Footer>
            {getOrderActions(order.status).map((option) => (
              <Button
                key={option.action}
                disabled={pending}
                variant={option.action === "cancel" ? "ghost" : "default"}
                onClick={() => onAction(order.id, option.action)}
              >
                {option.label}
              </Button>
            ))}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </Drawer.Footer>
        </Drawer.Content>
      ) : null}
    </Drawer>
  );
}

interface DetailLineProps {
  label: string;
  value: string;
}

function DetailLine({ label, value }: DetailLineProps) {
  return (
    <div className="grid gap-1 border-b border-border pb-3">
      <Text as="p" className="text-sm text-muted-foreground">
        {label}
      </Text>
      <Text as="p">{value}</Text>
    </div>
  );
}
