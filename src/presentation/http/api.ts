import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as HttpApi from "effect/unstable/httpapi/HttpApi";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "#domain/errors";
import { MenuSchema } from "#domain/menu";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  OrderIdSchema,
} from "#domain/order";
import { ListOrdersRequestSchema, PlaceOrderRequestSchema } from "#service/contracts";
import {
  cancelOrder,
  getOrder,
  listMenu,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing,
} from "#service/use-cases/index";
import { InternalAppError } from "#service/errors";

const HealthStatusSchema = Schema.Struct({
  status: Schema.Literal("ok"),
}).annotate({ identifier: "HealthStatus" });
const HEALTH_STATUS: typeof HealthStatusSchema.Type = { status: "ok" };

class HealthApi extends HttpApiGroup.make("health", { topLevel: true }).add(
  HttpApiEndpoint.get("check", "/health", {
    success: HealthStatusSchema,
  }),
) {}

class MenuApi extends HttpApiGroup.make("menu")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: MenuSchema,
      error: InternalAppError,
    }),
  )
  .prefix("/menu") {}

class OrdersApi extends HttpApiGroup.make("orders")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: PlaceOrderRequestSchema,
      success: CoffeeOrderSchema,
      error: [DrinkNotFoundError, InvalidOrderInputError, InternalAppError],
    }),
    HttpApiEndpoint.get("list", "/", {
      query: ListOrdersRequestSchema,
      success: CoffeeOrdersSchema,
      error: [InvalidOrderInputError, InternalAppError],
    }),
    HttpApiEndpoint.get("getById", "/:orderId", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [OrderNotFoundError, InternalAppError],
    }),
    HttpApiEndpoint.post("startBrewing", "/:orderId/start-brewing", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [OrderNotFoundError, InvalidOrderStatusTransitionError, InternalAppError],
    }),
    HttpApiEndpoint.post("markReady", "/:orderId/mark-ready", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [OrderNotFoundError, InvalidOrderStatusTransitionError, InternalAppError],
    }),
    HttpApiEndpoint.post("pickUp", "/:orderId/pick-up", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [OrderNotFoundError, InvalidOrderStatusTransitionError, InternalAppError],
    }),
    HttpApiEndpoint.post("cancel", "/:orderId/cancel", {
      params: {
        orderId: OrderIdSchema,
      },
      success: CoffeeOrderSchema,
      error: [OrderNotFoundError, InvalidOrderStatusTransitionError, InternalAppError],
    }),
  )
  .prefix("/orders") {}

export class CoffeeHttpApi extends HttpApi.make("coffee-order-api")
  .add(HealthApi)
  .add(MenuApi)
  .add(OrdersApi) {}

const HealthApiLive = HttpApiBuilder.group(CoffeeHttpApi, "health", (handlers) =>
  handlers.handle("check", () => Effect.succeed(HEALTH_STATUS)),
);

const MenuApiLive = HttpApiBuilder.group(CoffeeHttpApi, "menu", (handlers) =>
  handlers.handle("list", () => listMenu()),
);

const OrdersApiLive = HttpApiBuilder.group(CoffeeHttpApi, "orders", (handlers) =>
  handlers
    .handle("create", ({ payload }) => placeOrder(payload))
    .handle("list", ({ query }) => listOrders(query))
    .handle("getById", ({ params }) => getOrder(params.orderId))
    .handle("startBrewing", ({ params }) => startBrewing(params.orderId))
    .handle("markReady", ({ params }) => markReady(params.orderId))
    .handle("pickUp", ({ params }) => pickUpOrder(params.orderId))
    .handle("cancel", ({ params }) => cancelOrder(params.orderId)),
);

export const CoffeeHttpApiLive = Layer.provide(
  HttpApiBuilder.layer(CoffeeHttpApi, { openapiPath: "/openapi.json" }),
  [HealthApiLive, MenuApiLive, OrdersApiLive],
);
