import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrder,
  fetchMenu,
  fetchOrders,
  updateOrderStatus,
} from "#features/coffee-shop/api/coffee.ts";
import type {
  CoffeeOrder,
  MenuItem,
  OrderAction,
  PlaceOrderRequest,
} from "#features/coffee-shop/lib/coffee.ts";

const menuQueryKey = ["menu"] as const;
export const ordersQueryKey = ["orders"] as const;

interface OrdersQueryOptions {
  enabled?: boolean;
}

async function refreshOrders(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: ordersQueryKey });
}

export function useMenuQuery() {
  return useQuery<readonly MenuItem[]>({
    queryKey: menuQueryKey,
    queryFn: fetchMenu,
    staleTime: 60_000,
  });
}

export function useOrdersQuery(options: OrdersQueryOptions = {}) {
  return useQuery<readonly CoffeeOrder[]>({
    enabled: options.enabled ?? true,
    queryKey: ordersQueryKey,
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
