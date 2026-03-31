import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as ServiceMap from "effect/ServiceMap";
import { MenuSchema, type Menu } from "#domain/menu";
import {
  CoffeeOrderSchema,
  CoffeeOrdersSchema,
  ListOrdersRequestSchema,
  type CoffeeOrder,
  type CoffeeOrders,
  type ListOrdersRequest,
  type OrderId,
  OrderIdSchema,
  type PlaceOrderRequest,
  PlaceOrderRequestSchema,
} from "#domain/order";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { AppErrorSchema, type AppError } from "./schemas.ts";

const EmptyParamsSchema = Schema.Struct({});

export const coffeeMcpActionSpecs = {
  list_menu: {
    description: "List the current coffee menu",
    parameters: EmptyParamsSchema,
    success: MenuSchema,
    failure: AppErrorSchema,
  },
  place_order: {
    description: "Create a new coffee order",
    parameters: PlaceOrderRequestSchema,
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  get_order: {
    description: "Fetch one order by id",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  list_orders: {
    description: "List orders, optionally filtered by status",
    parameters: ListOrdersRequestSchema,
    success: CoffeeOrdersSchema,
    failure: AppErrorSchema,
  },
  start_brewing: {
    description: "Move an order from pending to brewing",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  mark_ready: {
    description: "Move an order from brewing to ready",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  pick_up_order: {
    description: "Move an order from ready to picked-up",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
  cancel_order: {
    description: "Cancel a pending or brewing order",
    parameters: Schema.Struct({
      orderId: OrderIdSchema,
    }),
    success: CoffeeOrderSchema,
    failure: AppErrorSchema,
  },
} as const;

export class CoffeeMcpActions extends ServiceMap.Service<
  CoffeeMcpActions,
  {
    readonly list_menu: () => Effect.Effect<Menu, AppError>;
    readonly place_order: (input: PlaceOrderRequest) => Effect.Effect<CoffeeOrder, AppError>;
    readonly get_order: (input: {
      readonly orderId: OrderId;
    }) => Effect.Effect<CoffeeOrder, AppError>;
    readonly list_orders: (input: ListOrdersRequest) => Effect.Effect<CoffeeOrders, AppError>;
    readonly start_brewing: (input: {
      readonly orderId: OrderId;
    }) => Effect.Effect<CoffeeOrder, AppError>;
    readonly mark_ready: (input: {
      readonly orderId: OrderId;
    }) => Effect.Effect<CoffeeOrder, AppError>;
    readonly pick_up_order: (input: {
      readonly orderId: OrderId;
    }) => Effect.Effect<CoffeeOrder, AppError>;
    readonly cancel_order: (input: {
      readonly orderId: OrderId;
    }) => Effect.Effect<CoffeeOrder, AppError>;
  }
>()("effect-v4-onion/presentation/mcp/CoffeeMcpActions") {
  static readonly layer = Layer.effect(
    CoffeeMcpActions,
    Effect.gen(function* () {
      const app = yield* CoffeeOrderApp;

      return CoffeeMcpActions.of({
        list_menu: () => app.listMenu(),
        place_order: (input) => app.placeOrder(input),
        get_order: ({ orderId }) => app.getOrder(orderId),
        list_orders: (input) => app.listOrders(input),
        start_brewing: ({ orderId }) => app.startBrewing(orderId),
        mark_ready: ({ orderId }) => app.markReady(orderId),
        pick_up_order: ({ orderId }) => app.pickUpOrder(orderId),
        cancel_order: ({ orderId }) => app.cancelOrder(orderId),
      });
    }),
  ).pipe(Layer.provide(CoffeeOrderApp.layer));
}
