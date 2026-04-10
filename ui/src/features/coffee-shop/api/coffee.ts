import * as Schema from "effect/Schema";
import type {
  CoffeeApiError,
  CoffeeOrder,
  MenuItem,
  OrderAction,
  PlaceOrderRequest,
} from "#features/coffee-shop/lib/coffee.ts";
import {
  CoffeeApiErrorSchema,
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  MenuSchema,
} from "#features/coffee-shop/lib/coffee-schemas.ts";

const apiBaseUrl = import.meta.env.VITE_COFFEE_API_URL ?? "/api";

function toRequestUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

async function readJson<S extends Schema.Decoder<unknown>>(
  response: Response,
  schema: S,
): Promise<S["Type"]> {
  const value = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(await response.text());
  return Schema.decodeUnknownPromise(schema)(value);
}

async function throwResponseError(response: Response): Promise<never> {
  const fallback = `${response.status} ${response.statusText}`;
  const message = await readJson(response, CoffeeApiErrorSchema)
    .then(readApiErrorMessage)
    .catch(() => fallback);

  throw new Error(message);
}

function readApiErrorMessage(error: CoffeeApiError): string {
  return error.message ?? error._tag ?? "Unknown API error";
}

async function request<S extends Schema.Decoder<unknown>>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<S["Type"]> {
  const response = await fetch(toRequestUrl(path), init);

  if (!response.ok) {
    return throwResponseError(response);
  }

  return readJson(response, schema);
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

export async function fetchMenu(): Promise<readonly MenuItem[]> {
  return request("/menu", MenuSchema);
}

export async function fetchOrders(): Promise<readonly CoffeeOrder[]> {
  return request("/orders", CoffeeOrdersSchema);
}

export async function createOrder(payload: PlaceOrderRequest): Promise<CoffeeOrder> {
  return request("/orders", CoffeeOrderSchema, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateOrderStatus(
  orderId: string,
  action: OrderAction,
): Promise<CoffeeOrder> {
  return request(getActionPath(orderId, action), CoffeeOrderSchema, { method: "POST" });
}
