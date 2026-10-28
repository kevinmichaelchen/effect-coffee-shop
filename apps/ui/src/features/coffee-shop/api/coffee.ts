import { CustomerApi } from "@effect-coffee-shop/coffee-domain/CustomerApi.api";
import { makeOrderId, OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
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
import {
  type HttpRequestError,
  type HttpResponseDecodeError,
  requestJson,
} from "#shared/lib/http.ts";
import {
  apiBaseUrl,
  customerRuntime,
  onRuntime,
  type StaffClient,
  staffRuntime,
} from "./domain-clients.ts";
import { OrderRequestError, toOrderRequestError } from "./order-failures.ts";
import { toCoffeeOrder } from "./order-mapping.ts";

function readApiErrorMessage(error: CoffeeApiError): string {
  return error.message ?? error._tag ?? "Unknown API error";
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

export const fetchMenu: Effect.Effect<
  readonly MenuItem[],
  HttpRequestError | HttpResponseDecodeError
> = requestJson({
  errorSchema: CoffeeApiError,
  path: `${apiBaseUrl}/menu`,
  readErrorMessage: readApiErrorMessage,
  schema: Menu,
});

export const createOrder = (
  payload: PlaceOrderRequest,
): Effect.Effect<OrderTicket, OrderRequestError> =>
  onRuntime(customerRuntime)(
    Effect.gen(function* () {
      const api = yield* CustomerApi.Client;
      const target = yield* makeOrderId;
      const { reply } = yield* api
        .PlaceOrder({ target, items: payload.items })
        .pipe(Effect.mapError(toOrderRequestError));
      return toCoffeeOrder(reply.order);
    }),
  );

export const updateOrderStatus = (
  orderId: string,
  action: OrderAction,
): Effect.Effect<OrderTicket, OrderRequestError> =>
  onRuntime(staffRuntime)(
    Effect.gen(function* () {
      const target = yield* decodeOrderId(orderId);
      const api = yield* StaffApi.Client;
      const { reply } = yield* staffActions[action](api, target).pipe(
        Effect.mapError(toOrderRequestError),
      );
      return toCoffeeOrder(reply.order);
    }),
  );
