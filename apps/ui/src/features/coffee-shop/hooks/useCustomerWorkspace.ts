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

function readMutationError(error: unknown): string {
  return error instanceof Error ? error.message : "Unable to place the order.";
}

async function submitCustomerOrder(input: {
  createOrderMutation: ReturnType<typeof useCreateOrderMutation>;
  draftState: ReturnType<typeof useOrderDraft>;
  setReceiptOrder: (order: CoffeeOrder | null) => void;
}): Promise<void> {
  const { createOrderMutation, draftState, setReceiptOrder } = input;

  if (draftState.draft === null) {
    return;
  }

  try {
    const order = await createOrderMutation.mutateAsync(toPlaceOrderRequest(draftState.draft));
    draftState.resetDraft();
    setReceiptOrder(order);
    toast.success(`Ticket ${order.id} queued for your account.`);
  } catch (error) {
    toast.error(readMutationError(error));
  }
}

function createSubmitOrderHandler(input: {
  createOrderMutation: ReturnType<typeof useCreateOrderMutation>;
  draftState: ReturnType<typeof useOrderDraft>;
  setReceiptOrder: (order: CoffeeOrder | null) => void;
}) {
  return async () => submitCustomerOrder(input);
}

function useCustomerQueries(viewer: ReturnType<typeof useViewerQuery>["data"]) {
  const canLoadOrders = viewer !== undefined && isAuthenticatedViewer(viewer);
  const menuQuery = useMenuQuery();
  const ordersQuery = useOrdersQuery({ enabled: canLoadOrders });

  return {
    menu: menuQuery.data ?? [],
    menuQuery,
    orders: ordersQuery.data ?? emptyOrders,
    ordersQuery,
  };
}

function getOrderGroups(orders: readonly CoffeeOrder[]) {
  return {
    activeOrders: orders.filter(isActiveOrder),
    historyOrders: orders.filter((order) => !isActiveOrder(order)).reverse(),
  };
}

export function useCustomerWorkspace() {
  const viewerQuery = useViewerQuery();
  const viewer = viewerQuery.data ?? anonymousViewer;
  const { menu, menuQuery, orders, ordersQuery } = useCustomerQueries(viewerQuery.data);
  const createOrderMutation = useCreateOrderMutation();
  const { theme, toggleTheme } = useThemePreference();
  const [receiptOrder, setReceiptOrder] = useState<CoffeeOrder | null>(null);
  const draftState = useOrderDraft(menu);
  const { activeOrders, historyOrders } = getOrderGroups(orders);
  const errorMessage = getErrorMessage(
    viewerQuery.error?.message,
    menuQuery.error?.message,
    ordersQuery.error?.message,
  );

  const submitOrder = createSubmitOrderHandler({
    createOrderMutation,
    draftState,
    setReceiptOrder,
  });

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
