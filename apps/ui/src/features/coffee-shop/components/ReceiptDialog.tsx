import { Button } from "#shared/ui/retroui/Button.tsx";
import { Dialog } from "#shared/ui/retroui/Dialog.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import { StatusBadge } from "#shared/ui/StatusBadge.tsx";
import { formatOrderTime, formatPrice } from "#features/coffee-shop/lib/coffee.ts";
import type { CoffeeOrder } from "#features/coffee-shop/lib/coffee.ts";

interface ReceiptDialogProps {
  actionLabel: string;
  order: CoffeeOrder | null;
  onClose: () => void;
  onOpenOrders: () => void;
}

export function ReceiptDialog(inputProps: ReceiptDialogProps) {
  const { actionLabel, order, onClose, onOpenOrders } = inputProps;

  return (
    <Dialog open={order !== null} onOpenChange={(open) => !open && onClose()}>
      {order !== null ? (
        <Dialog.Content className="max-w-xl" size="lg">
          <Dialog.Header>Order sent to the queue</Dialog.Header>
          <Dialog.Description className="px-4 pt-3 text-sm text-muted-foreground">
            Review the new ticket details, then keep ordering or jump to your active orders.
          </Dialog.Description>
          <div className="grid gap-5 px-4 pb-5 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={order.status} />
              <Text as="p" className="text-sm text-muted-foreground">
                Ticket {order.id} opened at {formatOrderTime(order.createdAt)}
              </Text>
            </div>
            <Text as="h3">{order.customerName}</Text>
            <Text as="p" className="text-lg">
              {order.drinkName}, {order.size}, {order.temperature}, {order.milk} milk, {order.shots}{" "}
              shot(s)
            </Text>
            {order.notes !== undefined ? (
              <Text as="p" className="text-base text-muted-foreground">
                Notes: {order.notes}
              </Text>
            ) : null}
            <Text as="h4" className="text-2xl">
              {formatPrice(order.priceCents)}
            </Text>
          </div>
          <Dialog.Footer position="static">
            <Button variant="outline" onClick={onClose}>
              Keep ordering
            </Button>
            <Button
              onClick={() => {
                onOpenOrders();
                onClose();
              }}
            >
              {actionLabel}
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      ) : null}
    </Dialog>
  );
}
