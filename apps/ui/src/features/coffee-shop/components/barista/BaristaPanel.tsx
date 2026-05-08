import { OrderDetailsDrawer } from "#features/coffee-shop/components/barista/OrderDetailsDrawer.tsx";
import { QueueBoardCard } from "#features/coffee-shop/components/barista/QueueBoardCard.tsx";
import { RecentActivityCard } from "#features/coffee-shop/components/barista/RecentActivityCard.tsx";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

interface BaristaPanelProps {
  activeOrders: readonly CoffeeOrder[];
  historyOrders: readonly CoffeeOrder[];
  pendingOrderId: string | null;
  selectedOrder: CoffeeOrder | null;
  onAction: (orderId: string, action: OrderAction) => void;
  onInspect: (orderId: string) => void;
  onOpenChange: (open: boolean) => void;
}

export function BaristaPanel(inputProps: BaristaPanelProps) {
  const {
    activeOrders,
    historyOrders,
    pendingOrderId,
    selectedOrder,
    onAction,
    onInspect,
    onOpenChange,
  } = inputProps;

  return (
    <section className="grid gap-5">
      <QueueBoardCard
        orders={activeOrders}
        pendingOrderId={pendingOrderId}
        onAction={onAction}
        onInspect={onInspect}
      />
      <RecentActivityCard orders={historyOrders} onInspect={onInspect} />
      <OrderDetailsDrawer
        order={selectedOrder}
        pending={pendingOrderId === selectedOrder?.id}
        onAction={onAction}
        onOpenChange={onOpenChange}
      />
    </section>
  );
}
