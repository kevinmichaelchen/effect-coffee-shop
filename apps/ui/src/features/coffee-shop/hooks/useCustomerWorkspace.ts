import { useState } from "react";
import { toast } from "sonner";
import { useViewerQuery } from "#features/auth/hooks/useViewerQuery.ts";
import { anonymousViewer, isAuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import {
  useCreateOrderMutation,
  useMenuQuery,
  useOrdersQuery,
} from "#features/coffee-shop/hooks/useCoffeeQueries.ts";
import { useOrderDraft } from "#features/coffee-shop/hooks/useOrderDraft.ts";
import { isActiveOrder, toPlaceOrderRequest } from "#features/coffee-shop/lib/coffee.ts";
import { useThemePreference } from "#shared/hooks/useThemePreference.ts";
import type { CoffeeOrder } from "#features/coffee-shop/lib/coffee.ts";

const emptyOrders: readonly CoffeeOrder[] = [];

function getErrorMessage(...messages: Array<string | undefined>): string | null {
  return messages.find((message) => message !== undefined) ?? null;
}

export function useCustomerWorkspace() {
  const viewerQuery = useViewerQuery();
  const viewer = viewerQuery.data ?? anonymousViewer;
  const canLoadOrders = isAuthenticatedViewer(viewer);
  const menuQuery = useMenuQuery();
  const ordersQuery = useOrdersQuery({ enabled: canLoadOrders });
  const createOrderMutation = useCreateOrderMutation();
  const { theme, toggleTheme } = useThemePreference();
  const [receiptOrder, setReceiptOrder] = useState<CoffeeOrder | null>(null);
  const menu = menuQuery.data ?? [];
  const orders = ordersQuery.data ?? emptyOrders;
  const draftState = useOrderDraft(menu);
  const activeOrders = orders.filter(isActiveOrder);
  const historyOrders = orders.filter((order) => !isActiveOrder(order)).reverse();
  const errorMessage = getErrorMessage(
    viewerQuery.error?.message,
    menuQuery.error?.message,
    ordersQuery.error?.message,
  );

  async function submitOrder(): Promise<void> {
    if (draftState.draft === null) {
      return;
    }

    try {
      const order = await createOrderMutation.mutateAsync(toPlaceOrderRequest(draftState.draft));
      draftState.resetDraft();
      setReceiptOrder(order);
      toast.success(`Ticket ${order.id} queued for your account.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to place the order.");
    }
  }

  return {
    activeOrders,
    createOrderMutation,
    draftState,
    errorMessage,
    historyOrders,
    menu,
    orders,
    ordersQuery,
    receiptOrder,
    theme,
    toggleTheme,
    viewer,
    viewerQuery,
    setReceiptOrder,
    submitOrder,
  };
}
