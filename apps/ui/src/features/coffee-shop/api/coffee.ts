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
  PlaceOrderRequestSchema,
} from "#features/coffee-shop/lib/coffee-schemas.ts";
import { requestJson } from "#shared/lib/http.ts";
import * as Schema from "effect/Schema";

const apiBaseUrl = import.meta.env.VITE_COFFEE_API_URL ?? "/api";
const encodePlaceOrderRequest = Schema.encodeUnknownSync(PlaceOrderRequestSchema);

function toRequestUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

function readApiErrorMessage(error: CoffeeApiError): string {
  return error.message ?? error._tag ?? "Unknown API error";
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
  return requestJson({
    errorSchema: CoffeeApiErrorSchema,
    path: toRequestUrl("/menu"),
    readErrorMessage: readApiErrorMessage,
    schema: MenuSchema,
  });
}

export async function fetchOrders(): Promise<readonly CoffeeOrder[]> {
  return requestJson({
    errorSchema: CoffeeApiErrorSchema,
    path: toRequestUrl("/orders"),
    readErrorMessage: readApiErrorMessage,
    schema: CoffeeOrdersSchema,
  });
}

export async function createOrder(payload: PlaceOrderRequest): Promise<CoffeeOrder> {
  return requestJson({
    errorSchema: CoffeeApiErrorSchema,
    init: {
      body: JSON.stringify(encodePlaceOrderRequest(payload)),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    path: toRequestUrl("/orders"),
    readErrorMessage: readApiErrorMessage,
    schema: CoffeeOrderSchema,
  });
}

export async function updateOrderStatus(
  orderId: string,
  action: OrderAction,
): Promise<CoffeeOrder> {
  return requestJson({
    errorSchema: CoffeeApiErrorSchema,
    init: { method: "POST" },
    path: toRequestUrl(getActionPath(orderId, action)),
    readErrorMessage: readApiErrorMessage,
    schema: CoffeeOrderSchema,
  });
}
