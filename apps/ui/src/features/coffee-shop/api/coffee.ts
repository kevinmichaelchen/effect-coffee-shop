import { CustomerId } from "@effect-coffee-shop/coffee-domain/Customer/Customer.id";
import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { makeOrderId, OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.aggregate";
import { StaffApi } from "@effect-coffee-shop/coffee-domain/StaffApi.api";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type { MenuItem, OrderAction } from "#features/coffee-shop/lib/coffee.ts";
import {
  CoffeeApiError,
  type OrderTicket,
  Menu,
  type PlaceOrderRequest,
} from "#features/coffee-shop/lib/coffee-schemas.ts";
import { requestJson } from "#shared/lib/http.ts";
import { apiBaseUrl, customerRuntime, type StaffClient, staffRuntime } from "./domain-clients.ts";
import { OrderRequestError, toOrderRequestError } from "./order-failures.ts";
import { toCoffeeOrder, toCoffeeOrders } from "./order-mapping.ts";

function readApiErrorMessage(error: CoffeeApiError): string {
  return error.message ?? error._tag ?? "Unknown API error";
}

function decodeCustomerId(userId: string): Effect.Effect<CustomerId, OrderRequestError> {
  return Schema.decodeEffect(CustomerId)(userId).pipe(
    Effect.mapError(() => new OrderRequestError({ message: "Sign in to place and view orders." })),
  );
}

function decodeOrderId(orderId: string): Effect.Effect<OrderId, OrderRequestError> {
  return Schema.decodeEffect(OrderId)(orderId).pipe(
    Effect.mapError(() => new OrderRequestError({ message: `${orderId} is not an order id.` })),
  );
}

const staffActions = {
  "start-brewing": (api: StaffClient, target: OrderId) => api.StartBrewing({ target }),
  "mark-ready": (api: StaffClient, target: OrderId) => api.MarkReady({ target }),
  "pick-up": (api: StaffClient, target: OrderId) => api.PickUpOrder({ target }),
  cancel: (api: StaffClient, target: OrderId) => api.CancelOrder({ target }),
} satisfies Record<OrderAction, unknown>;

export async function fetchMenu(): Promise<readonly MenuItem[]> {
  return requestJson({
    errorSchema: CoffeeApiError,
    path: `${apiBaseUrl}/menu`,
    readErrorMessage: readApiErrorMessage,
    schema: Menu,
  });
}

/** The signed-in customer's orders, oldest first. */
export async function fetchCustomerOrders(userId: string): Promise<readonly OrderTicket[]> {
  return customerRuntime.runPromise(
    Effect.gen(function* () {
      const customerId = yield* decodeCustomerId(userId);
      const api = yield* CustomerApi.Client;
      const view = yield* api.CustomerOrders.get(customerId).pipe(
        Effect.mapError(toOrderRequestError),
      );
      return toCoffeeOrders(view);
    }),
  );
}

/** The shop's queue for the baristas: open orders and recent history, oldest first. */
export async function fetchStaffQueue(): Promise<readonly OrderTicket[]> {
  return staffRuntime.runPromise(
    Effect.gen(function* () {
      const api = yield* StaffApi.Client;
      const view = yield* api.OrderQueue.get(mainShop).pipe(Effect.mapError(toOrderRequestError));
      return toCoffeeOrders(view);
    }),
  );
}

export async function createOrder(payload: PlaceOrderRequest): Promise<OrderTicket> {
  return customerRuntime.runPromise(
    Effect.gen(function* () {
      const api = yield* CustomerApi.Client;
      const target = yield* makeOrderId;
      const { reply } = yield* api
        .PlaceOrder({ target, items: payload.items })
        .pipe(Effect.mapError(toOrderRequestError));
      return toCoffeeOrder(reply.order);
    }),
  );
}

export async function updateOrderStatus(
  orderId: string,
  action: OrderAction,
): Promise<OrderTicket> {
  return staffRuntime.runPromise(
    Effect.gen(function* () {
      const target = yield* decodeOrderId(orderId);
      const api = yield* StaffApi.Client;
      const { reply } = yield* staffActions[action](api, target).pipe(
        Effect.mapError(toOrderRequestError),
      );
      return toCoffeeOrder(reply.order);
    }),
  );
}
