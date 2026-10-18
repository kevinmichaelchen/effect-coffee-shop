import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createOrder,
  fetchCustomerOrders,
  fetchMenu,
  fetchStaffQueue,
  updateOrderStatus,
} from "#features/coffee-shop/api/coffee.ts";
import type {
  OrderTicket,
  MenuItem,
  OrderAction,
  PlaceOrderRequest,
} from "#features/coffee-shop/lib/coffee.ts";

const menuQueryKey = ["menu"] as const;
/** Prefix of every order query (customer orders and the staff queue). */
export const ordersQueryKey = ["orders"] as const;
const staffQueueQueryKey = [...ordersQueryKey, "staff-queue"] as const;
const ordersRefetchInterval = 4_000;

function customerOrdersQueryKey(userId: string | null) {
  return [...ordersQueryKey, "customer", userId] as const;
}

export interface StaffQueueQueryOptions {
  enabled?: boolean;
}

function upsertOrder(orders: readonly OrderTicket[], order: OrderTicket): readonly OrderTicket[] {
  return orders.some((existing) => existing.id === order.id)
    ? orders.map((existing) => (existing.id === order.id ? order : existing))
    : [...orders, order];
}

/**
 * Show a command's reply right away in every cached order list. Views catch
 * up asynchronously, so an immediate refetch could still miss the change;
 * polling reconciles the lists with the server.
 */
function rememberOrder(queryClient: ReturnType<typeof useQueryClient>, order: OrderTicket): void {
  queryClient.setQueriesData<readonly OrderTicket[]>({ queryKey: ordersQueryKey }, (orders) =>
    orders === undefined ? orders : upsertOrder(orders, order),
  );
}

export function useMenuQuery() {
  return useQuery<readonly MenuItem[]>({
    queryKey: menuQueryKey,
    queryFn: fetchMenu,
    staleTime: 60_000,
  });
}

/** The signed-in customer's orders; idle until there is a user id. */
export function useCustomerOrdersQuery(userId: string | null) {
  return useQuery<readonly OrderTicket[]>({
    queryKey: customerOrdersQueryKey(userId),
    queryFn: userId === null ? skipToken : async () => fetchCustomerOrders(userId),
    refetchInterval: ordersRefetchInterval,
  });
}

export function useStaffQueueQuery(options: StaffQueueQueryOptions = {}) {
  return useQuery<readonly OrderTicket[]>({
    enabled: options.enabled ?? true,
    queryKey: staffQueueQueryKey,
    queryFn: fetchStaffQueue,
    refetchInterval: ordersRefetchInterval,
  });
}

export function useCreateOrderMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: PlaceOrderRequest) => createOrder(payload),
    onSuccess: (order) => rememberOrder(queryClient, order),
  });
}

export function useOrderActionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, action }: { orderId: string; action: OrderAction }) =>
      updateOrderStatus(orderId, action),
    onSuccess: (order) => rememberOrder(queryClient, order),
  });
}
