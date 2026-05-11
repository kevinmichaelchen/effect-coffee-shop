import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Option from "effect/Option";
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
  CartItemIdRequest,
  CartSnapshot,
  CheckoutCartRequest,
  ConfirmedCheckoutCartRequest,
  ConfirmedPlaceOrderRequest,
  ItemOptions,
  ItemOptionsRequest,
  ListOrdersRequest,
  OrderItemInput,
  OrderQuote,
  PlaceOrderRequest,
  QuoteOrderRequest,
  UpdateCartItemRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { InternalAppError } from "./errors.ts";
import { CartItemIdGenerator } from "./ports/CartItemIdGenerator.ts";
import { CartRepository } from "./ports/CartRepository.ts";
import { MenuRepository } from "./ports/MenuRepository.ts";
import { OrderIdGenerator } from "./ports/OrderIdGenerator.ts";
import { OrderRepository } from "./ports/OrderRepository.ts";
import { PendingOrderConfirmationRepository } from "./ports/PendingOrderConfirmationRepository.ts";
import {
  cancelOrder,
  addCartItem,
  checkoutConfirmedCart,
  checkoutCart,
  clearCart,
  getCart,
  getItemOptions,
  getOrder,
  getPendingOrderConfirmation,
  listMenu,
  listOrders,
  markReady,
  placeOrder,
  placeConfirmedOrder,
  pickUpOrder,
  quoteOrder,
  prepareCartConfirmation,
  prepareOrderConfirmation,
  removeCartItem,
  startBrewing,
  updateCartItem,
  validateOrder,
} from "./use-cases/index.ts";
import type { PendingOrderConfirmation } from "../domain/pending-order-confirmation.ts";

export class CoffeeOrderApp extends Context.Service<
  CoffeeOrderApp,
  {
    readonly listMenu: () => Effect.Effect<Menu, InternalAppError>;
    readonly getItemOptions: (
      input: ItemOptionsRequest,
    ) => Effect.Effect<ItemOptions, DrinkNotFoundError | InternalAppError>;
    readonly validateOrder: (
      input: QuoteOrderRequest,
    ) => Effect.Effect<OrderQuote, DrinkNotFoundError | InvalidOrderInputError | InternalAppError>;
    readonly quoteOrder: (
      input: QuoteOrderRequest,
    ) => Effect.Effect<OrderQuote, DrinkNotFoundError | InvalidOrderInputError | InternalAppError>;
    readonly prepareOrderConfirmation: (
      input: QuoteOrderRequest,
    ) => Effect.Effect<
      PendingOrderConfirmation,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly prepareCartConfirmation: () => Effect.Effect<
      PendingOrderConfirmation,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly getPendingOrderConfirmation: () => Effect.Effect<
      Option.Option<PendingOrderConfirmation>,
      AuthenticationRequiredError | InternalAppError
    >;
    readonly placeOrder: (
      input: PlaceOrderRequest,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly placeConfirmedOrder: (
      input: ConfirmedPlaceOrderRequest,
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
    readonly getCart: () => Effect.Effect<
      CartSnapshot,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly addCartItem: (
      input: OrderItemInput,
    ) => Effect.Effect<
      CartSnapshot,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly updateCartItem: (
      input: UpdateCartItemRequest,
    ) => Effect.Effect<
      CartSnapshot,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly removeCartItem: (
      input: CartItemIdRequest,
    ) => Effect.Effect<
      CartSnapshot,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly clearCart: () => Effect.Effect<
      CartSnapshot,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly checkoutCart: (
      input: CheckoutCartRequest,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
    readonly checkoutConfirmedCart: (
      input: ConfirmedCheckoutCartRequest,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError
    >;
  }
>()("effect-coffee-shop/application/CoffeeOrderApp") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const menuRepository = yield* MenuRepository;
      const cartItemIdGenerator = yield* CartItemIdGenerator;
      const cartRepository = yield* CartRepository;
      const orderIdGenerator = yield* OrderIdGenerator;
      const orderRepository = yield* OrderRepository;
      const pendingOrderConfirmationRepository = yield* PendingOrderConfirmationRepository;

      return CoffeeOrderApp.of({
        listMenu: () => listMenu().pipe(Effect.provideService(MenuRepository, menuRepository)),
        getItemOptions: (input) =>
          getItemOptions(input).pipe(Effect.provideService(MenuRepository, menuRepository)),
        validateOrder: (input) =>
          validateOrder(input).pipe(Effect.provideService(MenuRepository, menuRepository)),
        quoteOrder: (input) =>
          quoteOrder(input).pipe(Effect.provideService(MenuRepository, menuRepository)),
        prepareOrderConfirmation: (input) =>
          prepareOrderConfirmation(input).pipe(
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(
              PendingOrderConfirmationRepository,
              pendingOrderConfirmationRepository,
            ),
          ),
        prepareCartConfirmation: () =>
          prepareCartConfirmation().pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(
              PendingOrderConfirmationRepository,
              pendingOrderConfirmationRepository,
            ),
          ),
        getPendingOrderConfirmation: () =>
          getPendingOrderConfirmation().pipe(
            Effect.provideService(
              PendingOrderConfirmationRepository,
              pendingOrderConfirmationRepository,
            ),
          ),
        placeOrder: (input) =>
          placeOrder(input).pipe(
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
          ),
        placeConfirmedOrder: (input) =>
          placeConfirmedOrder(input).pipe(
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
            Effect.provideService(
              PendingOrderConfirmationRepository,
              pendingOrderConfirmationRepository,
            ),
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
        getCart: () =>
          getCart().pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
          ),
        addCartItem: (input) =>
          addCartItem(input).pipe(
            Effect.provideService(CartItemIdGenerator, cartItemIdGenerator),
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
          ),
        updateCartItem: (input) =>
          updateCartItem(input).pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
          ),
        removeCartItem: (input) =>
          removeCartItem(input).pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
          ),
        clearCart: () =>
          clearCart().pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
          ),
        checkoutCart: (input) =>
          checkoutCart(input).pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
          ),
        checkoutConfirmedCart: (input) =>
          checkoutConfirmedCart(input).pipe(
            Effect.provideService(CartRepository, cartRepository),
            Effect.provideService(MenuRepository, menuRepository),
            Effect.provideService(OrderIdGenerator, orderIdGenerator),
            Effect.provideService(OrderRepository, orderRepository),
            Effect.provideService(
              PendingOrderConfirmationRepository,
              pendingOrderConfirmationRepository,
            ),
          ),
      });
    }),
  );
}
