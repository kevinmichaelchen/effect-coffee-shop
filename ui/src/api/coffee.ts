import type {
  CoffeeApiError,
  CoffeeOrder,
  MenuItem,
  OrderAction,
  PlaceOrderRequest,
} from "#lib/coffee";

const apiBaseUrl = import.meta.env.VITE_COFFEE_API_URL ?? "/api";

function toRequestUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

async function throwResponseError(response: Response): Promise<never> {
  const fallback = `${response.status} ${response.statusText}`;
  let message = fallback;

  try {
    const error = await readJson<CoffeeApiError>(response);
    message = error.message ?? error._tag ?? fallback;
  } catch {
    message = fallback;
  }

  throw new Error(message);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(toRequestUrl(path), init);

  if (!response.ok) {
    return throwResponseError(response);
  }

  return readJson<T>(response);
}

function getActionPath(orderId: string, action: OrderAction): string {
  const actionPaths: Record<OrderAction, string> = {
    "start-brewing": "start-brewing",
    "mark-ready": "mark-ready",
    "pick-up": "pick-up",
    cancel: "cancel",
  };

  return `/orders/${orderId}/${actionPaths[action]}`;
}

export async function fetchMenu(): Promise<MenuItem[]> {
  return request<MenuItem[]>("/menu");
}

export async function fetchOrders(): Promise<CoffeeOrder[]> {
  return request<CoffeeOrder[]>("/orders");
}

export async function createOrder(payload: PlaceOrderRequest): Promise<CoffeeOrder> {
  return request<CoffeeOrder>("/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateOrderStatus(orderId: string, action: OrderAction): Promise<CoffeeOrder> {
  return request<CoffeeOrder>(getActionPath(orderId, action), { method: "POST" });
}
