import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createOrder, fetchMenu, fetchOrders, updateOrderStatus } from "#features/coffee-shop/api/coffee.ts";
import type { OrderAction, PlaceOrderRequest } from "#features/coffee-shop/lib/coffee.ts";

const menuKey = ["menu"] as const;
const ordersKey = ["orders"] as const;

async function refreshOrders(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ordersKey });
}

export function useMenuQuery() {
  return useQuery({
    queryKey: menuKey,
    queryFn: fetchMenu,
    staleTime: 60_000,
  });
}

export function useOrdersQuery() {
  return useQuery({
    queryKey: ordersKey,
    queryFn: fetchOrders,
    refetchInterval: 4_000,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PlaceOrderRequest) => createOrder(payload),
    onSuccess: async () => refreshOrders(queryClient),
  });
}

export function useOrderActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: OrderAction }) =>
      updateOrderStatus(orderId, action),
    onSuccess: async () => refreshOrders(queryClient),
  });
}
