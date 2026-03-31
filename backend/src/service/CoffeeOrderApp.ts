import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as ServiceMap from "effect/ServiceMap";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "#domain/errors";
import type { Menu } from "#domain/menu";
import type { CoffeeOrder, CoffeeOrders, OrderId } from "#domain/order";
import type { ListOrdersRequest, PlaceOrderRequest } from "#service/contracts";
import { InternalAppError } from "./errors.ts";
import { MenuRepository } from "./ports/MenuRepository.ts";
import { OrderIdGenerator } from "./ports/OrderIdGenerator.ts";
import { OrderRepository } from "./ports/OrderRepository.ts";
import {
  cancelOrder,
  getOrder,
  listMenu,
  listOrders,
  markReady,
  placeOrder,
  pickUpOrder,
  startBrewing,
} from "./use-cases/index.ts";

export class CoffeeOrderApp extends ServiceMap.Service<
  CoffeeOrderApp,
  {
    readonly listMenu: () => Effect.Effect<Menu, InternalAppError>;
    readonly placeOrder: (
      input: PlaceOrderRequest,
    ) => Effect.Effect<CoffeeOrder, DrinkNotFoundError | InvalidOrderInputError | InternalAppError>;
    readonly getOrder: (
      orderId: OrderId,
    ) => Effect.Effect<CoffeeOrder, OrderNotFoundError | InternalAppError>;
    readonly listOrders: (
      input: ListOrdersRequest,
    ) => Effect.Effect<CoffeeOrders, InvalidOrderInputError | InternalAppError>;
    readonly startBrewing: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      InvalidOrderStatusTransitionError | OrderNotFoundError | InternalAppError
    >;
    readonly markReady: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      InvalidOrderStatusTransitionError | OrderNotFoundError | InternalAppError
    >;
    readonly pickUpOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      InvalidOrderStatusTransitionError | OrderNotFoundError | InternalAppError
    >;
    readonly cancelOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      InvalidOrderStatusTransitionError | OrderNotFoundError | InternalAppError
    >;
  }
>()("effect-v4-onion/service/CoffeeOrderApp") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const menuRepository = yield* MenuRepository;
      const orderIdGenerator = yield* OrderIdGenerator;
      const orderRepository = yield* OrderRepository;

      return CoffeeOrderApp.of({
        listMenu: () => listMenu().pipe(Effect.provideService(MenuRepository, menuRepository)),
        placeOrder: (input) =>
          placeOrder(input).pipe(
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
          ),
        getOrder: (orderId) =>
          getOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        listOrders: (input) =>
          listOrders(input).pipe(Effect.provideService(OrderRepository, orderRepository)),
        startBrewing: (orderId) =>
          startBrewing(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        markReady: (orderId) =>
          markReady(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        pickUpOrder: (orderId) =>
          pickUpOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
        cancelOrder: (orderId) =>
          cancelOrder(orderId).pipe(Effect.provideService(OrderRepository, orderRepository)),
      });
    }),
  );
}
