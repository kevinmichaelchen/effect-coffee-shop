import { OrderDetailsDrawer } from "#components/barista/OrderDetailsDrawer";
import { QueueBoardCard } from "#components/barista/QueueBoardCard";
import { QueueSummary } from "#components/barista/QueueSummary";
import { RecentActivityCard } from "#components/barista/RecentActivityCard";
import type { CoffeeOrder, OrderAction } from "#lib/coffee";

interface BaristaPanelProps {
  activeOrders: readonly CoffeeOrder[];
  historyOrders: readonly CoffeeOrder[];
  pendingOrderId: string | null;
  queueLoad: number;
  readyCount: number;
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
    queueLoad,
    readyCount,
    selectedOrder,
    onAction,
    onInspect,
    onOpenChange,
  } = inputProps;

  return (
    <section className="grid gap-6">
      <QueueSummary
        activeCount={activeOrders.length}
        historyCount={historyOrders.length}
        queueLoad={queueLoad}
        readyCount={readyCount}
      />
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
