import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import type { Menu } from "@effect-coffee-shop/coffee-core/domain/menu";
import type {
  CoffeeOrder,
  CoffeeOrders,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import type {
  ListOrdersRequest,
  PlaceOrderRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
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

export class CoffeeOrderApp extends Context.Service<
  CoffeeOrderApp,
  {
    readonly listMenu: () => Effect.Effect<Menu, InternalAppError>;
    readonly placeOrder: (
      input: PlaceOrderRequest,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly getOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | OrderNotFoundError | InternalAppError
    >;
    readonly listOrders: (
      input: ListOrdersRequest,
    ) => Effect.Effect<
      CoffeeOrders,
      AuthenticationRequiredError | InvalidOrderInputError | InternalAppError
    >;
    readonly startBrewing: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      | AuthenticationRequiredError
      | InvalidOrderStatusTransitionError
      | OrderNotFoundError
      | StaffRoleRequiredError
      | InternalAppError
    >;
    readonly markReady: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      | AuthenticationRequiredError
      | InvalidOrderStatusTransitionError
      | OrderNotFoundError
      | StaffRoleRequiredError
      | InternalAppError
    >;
    readonly pickUpOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      | AuthenticationRequiredError
      | InvalidOrderStatusTransitionError
      | OrderNotFoundError
      | StaffRoleRequiredError
      | InternalAppError
    >;
    readonly cancelOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      | AuthenticationRequiredError
      | InvalidOrderStatusTransitionError
      | OrderNotFoundError
      | StaffRoleRequiredError
      | InternalAppError
    >;
  }
>()("effect-coffee-shop/application/CoffeeOrderApp") {
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
