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
import { MenuRepository } from "#service/ports/MenuRepository";
import { OrderIdGenerator } from "#service/ports/OrderIdGenerator";
import { OrderRepository } from "#service/ports/OrderRepository";
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
      const menuRepository = yield* MenuRepository;
      const orderIdGenerator = yield* OrderIdGenerator;
      const orderRepository = yield* OrderRepository;

      return CoffeeMcpActions.of({
        list_menu: () => listMenu().pipe(Effect.provideService(MenuRepository, menuRepository)),
        place_order: (input) =>
          placeOrder(input).pipe(
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
          ),
        get_order: ({ orderId }) =>
          getOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        list_orders: (input) =>
          listOrders(input).pipe(Effect.provideService(OrderRepository, orderRepository)),
        start_brewing: ({ orderId }) =>
          startBrewing(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        mark_ready: ({ orderId }) =>
          markReady(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        pick_up_order: ({ orderId }) =>
          pickUpOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        cancel_order: ({ orderId }) =>
          cancelOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
      });
    }),
  );
}
