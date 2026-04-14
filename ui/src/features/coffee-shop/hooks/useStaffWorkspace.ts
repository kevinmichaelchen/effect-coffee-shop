import { useNavigate, useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import { appRoutes } from "#app/routes.ts";
import { useViewerQuery } from "#features/auth/hooks/useViewerQuery.ts";
import {
  anonymousViewer,
  isAuthenticatedViewer,
  isStaffViewer,
} from "#features/auth/lib/viewer.ts";
import {
  useOrderActionMutation,
  useOrdersQuery,
} from "#features/coffee-shop/hooks/useCoffeeQueries.ts";
import { getQueueLoad, isActiveOrder } from "#features/coffee-shop/lib/coffee.ts";
import { useThemePreference } from "#shared/hooks/useThemePreference.ts";
import type { CoffeeOrder, OrderAction } from "#features/coffee-shop/lib/coffee.ts";

const emptyOrders: readonly CoffeeOrder[] = [];

function getErrorMessage(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => message !== undefined) ?? null;
}

function readMutationError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to update the order.";
}

function getStaffQueueSnapshot(orders: readonly CoffeeOrder[], selectedOrderId: string | null) {
  const activeOrders = orders.filter(isActiveOrder);
  const historyOrders = orders.filter((order) => !isActiveOrder(order)).reverse();

  return {
    activeOrders,
    historyOrders,
    queueLoad: getQueueLoad(activeOrders.length),
    readyCount: activeOrders.filter((order) => order.status === "ready").length,
    selectedOrder: orders.find((order) => order.id === selectedOrderId) ?? null,
  };
}

function updateSelectedOrderSearch<TSearch extends { order?: string }>(
  previous: TSearch,
  orderId: string | null,
): TSearch {
  if (orderId === null) {
    return { ...previous, order: undefined };
  }

  return { ...previous, order: orderId };
}

function useOrderActionHandler(
  orderActionMutation: ReturnType<typeof useOrderActionMutation>,
  setSelectedOrderId: (orderId: string | null) => void,
) {
  return async function handleOrderAction(orderId: string, action: OrderAction): Promise<void> {
    try {
      const order = await orderActionMutation.mutateAsync({ orderId, action });
      setSelectedOrderId(order.id);
      toast.success(`${order.drinkName} moved to ${order.status}.`);
    } catch (error) {
      toast.error(readMutationError(error));
    }
  };
}

export function useStaffWorkspace() {
  const viewerQuery = useViewerQuery();
  const viewer = viewerQuery.data ?? anonymousViewer;
  const canLoadOrders = isAuthenticatedViewer(viewer) && isStaffViewer(viewer);
  const ordersQuery = useOrdersQuery({ enabled: canLoadOrders });
  const orderActionMutation = useOrderActionMutation();
  const navigate = useNavigate({ from: appRoutes.staff });
  const selectedOrderId = useSearch({
    from: appRoutes.staff,
    select: (search) => search.order ?? null,
  });
  const { theme, toggleTheme } = useThemePreference();
  const orders = ordersQuery.data ?? emptyOrders;
  const { activeOrders, historyOrders, queueLoad, readyCount, selectedOrder } =
    getStaffQueueSnapshot(orders, selectedOrderId);
  const pendingOrderId = orderActionMutation.variables?.orderId ?? null;
  const errorMessage = getErrorMessage(viewerQuery.error?.message, ordersQuery.error?.message);
  function setSelectedOrderId(orderId: string | null) {
    void navigate({
      resetScroll: false,
      search: (previous) => updateSelectedOrderSearch(previous, orderId),
      to: appRoutes.staff,
    });
  }
  const handleOrderAction = useOrderActionHandler(orderActionMutation, setSelectedOrderId);

  return {
    activeOrders,
    errorMessage,
    historyOrders,
    orders,
    ordersQuery,
    pendingOrderId,
    queueLoad,
    readyCount,
    selectedOrder,
    theme,
    toggleTheme,
    viewer,
    viewerQuery,
    setSelectedOrderId,
    handleOrderAction,
  };
}
