import { useState } from "react";
import { toast } from "sonner";
import { type ViewMode } from "#components/app/view-mode";
import { useCreateOrderMutation, useMenuQuery, useOrderActionMutation, useOrdersQuery } from "#hooks/useCoffeeQueries";
import { useOrderDraft } from "#hooks/useOrderDraft";
import { useThemePreference } from "#hooks/useThemePreference";
import { getQueueLoad, isActiveOrder, toPlaceOrderRequest } from "#lib/coffee";
import type { CoffeeOrder, MenuItem, OrderAction } from "#lib/coffee";

const emptyMenu: MenuItem[] = [];
const emptyOrders: CoffeeOrder[] = [];

function getErrorMessage(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => message !== undefined) ?? null;
}

function getMenu(menuQuery: ReturnType<typeof useMenuQuery>): readonly MenuItem[] {
  return menuQuery.data ?? emptyMenu;
}

function getMenuCount(menuQuery: ReturnType<typeof useMenuQuery>): number {
  return menuQuery.data?.length ?? 0;
}

function getOrders(ordersQuery: ReturnType<typeof useOrdersQuery>): readonly CoffeeOrder[] {
  return ordersQuery.data ?? emptyOrders;
}

function getPendingOrderId(mutation: ReturnType<typeof useOrderActionMutation>): string | null {
  return mutation.variables?.orderId ?? null;
}

function getQueueSnapshot(orders: readonly CoffeeOrder[], selectedOrderId: string | null, pendingOrderId: string | null) {
  const activeOrders = orders.filter(isActiveOrder);
  const historyOrders = orders.filter((order) => !isActiveOrder(order)).reverse();
  const readyCount = activeOrders.filter((order) => order.status === "ready").length;
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  return { activeOrders, historyOrders, pendingOrderId, queueLoad: getQueueLoad(activeOrders.length), readyCount, selectedOrder };
}

function useWorkspaceControls() {
  const [receiptOrder, setReceiptOrder] = useState<CoffeeOrder | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("dual");
  return { receiptOrder, selectedOrderId, setReceiptOrder, setSelectedOrderId, setViewMode, viewMode };
}

function useOrderHandlers(inputProps: {
  draft: ReturnType<typeof useOrderDraft>["draft"];
  createOrderMutation: ReturnType<typeof useCreateOrderMutation>;
  orderActionMutation: ReturnType<typeof useOrderActionMutation>;
  resetDraft: () => void;
  setReceiptOrder: (order: CoffeeOrder | null) => void;
  setSelectedOrderId: (orderId: string | null) => void;
}) {
  const { draft, createOrderMutation, orderActionMutation, resetDraft, setReceiptOrder, setSelectedOrderId } = inputProps;

  async function handleSubmit(): Promise<void> {
    try {
      if (draft === null) {
        return;
      }

      const order = await createOrderMutation.mutateAsync(toPlaceOrderRequest(draft));
      resetDraft();
      setReceiptOrder(order);
      toast.success(`Ticket ${order.id} queued for ${order.customerName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to place the order.");
    }
  }

  async function handleOrderAction(orderId: string, action: OrderAction): Promise<void> {
    try {
      const updatedOrder = await orderActionMutation.mutateAsync({ orderId, action });
      setSelectedOrderId(updatedOrder.id);
      toast.success(`${updatedOrder.drinkName} moved to ${updatedOrder.status}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update the ticket.");
    }
  }

  return { handleOrderAction, handleSubmit };
}

export function useCoffeeShopState() {
  const menuQuery = useMenuQuery();
  const ordersQuery = useOrdersQuery();
  const createOrderMutation = useCreateOrderMutation();
  const orderActionMutation = useOrderActionMutation();
  const { theme, toggleTheme } = useThemePreference();
  const workspace = useWorkspaceControls();
  const menu = getMenu(menuQuery);
  const orders = getOrders(ordersQuery);
  const draftState = useOrderDraft(menu);
  const pendingOrderId = getPendingOrderId(orderActionMutation);
  const queue = getQueueSnapshot(orders, workspace.selectedOrderId, pendingOrderId);
  const actions = useOrderHandlers({
    draft: draftState.draft,
    createOrderMutation,
    orderActionMutation,
    resetDraft: draftState.resetDraft,
    setReceiptOrder: workspace.setReceiptOrder,
    setSelectedOrderId: workspace.setSelectedOrderId,
  });
  const errorMessage = getErrorMessage(menuQuery.error?.message, ordersQuery.error?.message);

  return {
    actions,
    createOrderMutation,
    draftState,
    errorMessage,
    menu,
    menuCount: getMenuCount(menuQuery),
    orders,
    ordersQuery,
    queue,
    theme,
    toggleTheme,
    workspace,
  };
}
