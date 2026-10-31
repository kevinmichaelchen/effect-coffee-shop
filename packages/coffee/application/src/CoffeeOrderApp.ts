/**
 * Serves Coffee adapters (MCP tools, REST) from the domain model: requests
 * become commands sent to aggregates, and reads come from views. Domain
 * rejections are translated into the adapters' error types here.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { AddCartItem } from "@effect-coffee-shop/coffee-domain/Cart/AddCartItem.command";
import { Cart, snapshotOf } from "@effect-coffee-shop/coffee-domain/Cart/Cart.aggregate";
import { makeCartItemId } from "@effect-coffee-shop/coffee-domain/Cart/CartItem.id";
import type { CartSnapshot as DomainCartSnapshot } from "@effect-coffee-shop/coffee-domain/Cart/CartSnapshot";
import { type Checkout, makeCheckoutId } from "@effect-coffee-shop/coffee-domain/Cart/Checkout";
import { ClearCart } from "@effect-coffee-shop/coffee-domain/Cart/ClearCart.command";
import type { CartItemNotFound } from "@effect-coffee-shop/coffee-domain/Cart/CartItemNotFound.rejection";
import {
  type CheckoutExpired,
  type CheckoutNotFound,
  ConfirmCheckout,
} from "@effect-coffee-shop/coffee-domain/Cart/ConfirmCheckout.command";
import type { NotYourCart } from "@effect-coffee-shop/coffee-domain/Cart/NotYourCart.rejection";
import { PrepareCheckout } from "@effect-coffee-shop/coffee-domain/Cart/PrepareCheckout.command";
import { RemoveCartItem } from "@effect-coffee-shop/coffee-domain/Cart/RemoveCartItem.command";
import { UpdateCartItem } from "@effect-coffee-shop/coffee-domain/Cart/UpdateCartItem.command";
import { CurrentActor as DomainActor } from "@effect-coffee-shop/coffee-domain/CurrentActor.context";
import { Customer } from "@effect-coffee-shop/coffee-domain/Customer/Customer.aggregate";
import {
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  drinkSizes,
  findMenuItem,
  type Menu,
  menuItems,
} from "@effect-coffee-shop/coffee-domain/Menu/Menu";
import type { DrinkNotFound } from "@effect-coffee-shop/coffee-domain/Menu/DrinkNotFound.rejection";
import type { InvalidOrder } from "@effect-coffee-shop/coffee-domain/Menu/InvalidOrder.rejection";
import { quoteOrder as priceOrder } from "@effect-coffee-shop/coffee-domain/Menu/OrderItem";
import { Quantity } from "@effect-coffee-shop/coffee-domain/Menu/OrderPrimitives";
import { CancelOrder } from "@effect-coffee-shop/coffee-domain/Order/CancelOrder.command";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { CustomerOrders } from "@effect-coffee-shop/coffee-domain/Order/CustomerOrders.view";
import { MarkReady } from "@effect-coffee-shop/coffee-domain/Order/MarkReady.command";
import { Order } from "@effect-coffee-shop/coffee-domain/Order/Order.aggregate";
import { makeOrderId, type OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { OrderQueue } from "@effect-coffee-shop/coffee-domain/Order/OrderQueue.view";
import { OrderStatus } from "@effect-coffee-shop/coffee-domain/Order/OrderStatus";
import { OrderSummary } from "@effect-coffee-shop/coffee-domain/Order/OrderSummary.view";
import { PickUpOrder } from "@effect-coffee-shop/coffee-domain/Order/PickUpOrder.command";
import {
  type AlreadyPlaced,
  PlaceOrder,
} from "@effect-coffee-shop/coffee-domain/Order/PlaceOrder.command";
import { StartBrewing } from "@effect-coffee-shop/coffee-domain/Order/StartBrewing.command";
import { mainShop, Shop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.aggregate";
import type {
  CartItemIdRequest,
  CartSnapshot,
  CheckoutCartRequest,
  CheckoutSession,
  ItemOptions,
  ItemOptionsRequest,
  ListOrdersRequest,
  OrderItemInput,
  OrderQuote,
  PlaceOrderRequest,
  QuoteOrderRequest,
  UpdateCartItemRequest,
} from "./contracts.ts";
import {
  type AuthenticatedActor,
  type AuthenticationRequiredError,
  type CurrentActor,
  requireSignedInActor,
  requireStaffActor,
  type StaffRoleRequiredError,
  staffRoleRequiredError,
} from "./CurrentActor.ts";
import {
  DrinkNotFoundError,
  InternalAppError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "./errors.ts";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
  recordOrderAction,
} from "./observability.ts";

type OrderInputError = DrinkNotFoundError | InvalidOrderInputError | InternalAppError;
type CartError = AuthenticationRequiredError | OrderInputError;
type OrderStatusError =
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError;

/** How long a checkout waits for its order to be placed by the domain's policy. */
const checkoutPlacementTimeout = "10 seconds";

const defaultQuantity = Schema.decodeSync(Quantity)(1);
const decodeOrderStatus = Schema.decodeUnknownOption(OrderStatus);

const internal = (message: string) => (cause: unknown) => new InternalAppError({ message, cause });

type OrderRejection = AlreadyPlaced | DrinkNotFound | InvalidOrder;
type CartRejection =
  | NotYourCart
  | CartItemNotFound
  | CheckoutNotFound
  | CheckoutExpired
  | DrinkNotFound
  | InvalidOrder;

/** Translate the rejections an order-shaped request can meet into adapter errors. */
const fromOrderRejection =
  (message: string) =>
  (rejection: OrderRejection): OrderInputError =>
    Match.value(rejection).pipe(
      Match.tagsExhaustive({
        DrinkNotFound: ({ drinkId }) => new DrinkNotFoundError({ drinkId }),
        InvalidOrder: (invalid) => new InvalidOrderInputError({ message: invalid.message }),
        AlreadyPlaced: internal(message),
      }),
    );

const fromCartRejection =
  (message: string) =>
  (rejection: CartRejection): OrderInputError =>
    Match.value(rejection).pipe(
      Match.tagsExhaustive({
        CartItemNotFound: ({ cartItemId }) =>
          new InvalidOrderInputError({ message: `cart item ${cartItemId} was not found` }),
        CheckoutNotFound: ({ checkoutId }) =>
          new InvalidOrderInputError({ message: `checkout session ${checkoutId} was not found` }),
        CheckoutExpired: ({ checkoutId }) =>
          new InvalidOrderInputError({ message: `checkout session ${checkoutId} has expired` }),
        DrinkNotFound: ({ drinkId }) => new DrinkNotFoundError({ drinkId }),
        InvalidOrder: (invalid) => new InvalidOrderInputError({ message: invalid.message }),
        // Requests always address the caller's own cart.
        NotYourCart: internal(message),
      }),
    );

const asDomainActor =
  (actor: AuthenticatedActor) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    Effect.provideService(effect, DomainActor, actor);

const toCartSnapshot = (actor: AuthenticatedActor, cart: DomainCartSnapshot): CartSnapshot => ({
  ownerUserId: actor.userId,
  items: cart.items,
  totalPrice: cart.totalPrice,
});

const toCheckoutSession = (actor: AuthenticatedActor, checkout: Checkout): CheckoutSession => ({
  id: checkout.checkoutId,
  ownerUserId: actor.userId,
  status: "awaiting_confirmation",
  items: checkout.items,
  totalPrice: checkout.totalPrice,
  createdAt: checkout.createdAt,
  updatedAt: checkout.createdAt,
  expiresAt: checkout.expiresAt,
});

const quote = (items: ReadonlyArray<OrderItemInput>) =>
  Effect.fromResult(priceOrder(items)).pipe(Effect.mapError(fromOrderRejection("Unable to quote")));

export class CoffeeOrderApp extends Context.Service<
  CoffeeOrderApp,
  {
    readonly listMenu: Effect.Effect<Menu, InternalAppError>;
    readonly getItemOptions: (
      input: ItemOptionsRequest,
    ) => Effect.Effect<ItemOptions, DrinkNotFoundError | InternalAppError>;
    readonly validateOrder: (
      input: QuoteOrderRequest,
    ) => Effect.Effect<OrderQuote, OrderInputError>;
    readonly quoteOrder: (input: QuoteOrderRequest) => Effect.Effect<OrderQuote, OrderInputError>;
    readonly placeOrder: (
      input: PlaceOrderRequest,
    ) => Effect.Effect<CoffeeOrder, AuthenticationRequiredError | OrderInputError, CurrentActor>;
    readonly getOrder: (
      orderId: OrderId,
    ) => Effect.Effect<
      CoffeeOrder,
      AuthenticationRequiredError | OrderNotFoundError | InternalAppError,
      CurrentActor
    >;
    readonly listOrders: (
      input: ListOrdersRequest,
    ) => Effect.Effect<
      ReadonlyArray<CoffeeOrder>,
      AuthenticationRequiredError | InvalidOrderInputError | InternalAppError,
      CurrentActor
    >;
    readonly startBrewing: (
      orderId: OrderId,
    ) => Effect.Effect<CoffeeOrder, OrderStatusError, CurrentActor>;
    readonly markReady: (
      orderId: OrderId,
    ) => Effect.Effect<CoffeeOrder, OrderStatusError, CurrentActor>;
    readonly pickUpOrder: (
      orderId: OrderId,
    ) => Effect.Effect<CoffeeOrder, OrderStatusError, CurrentActor>;
    readonly cancelOrder: (
      orderId: OrderId,
    ) => Effect.Effect<CoffeeOrder, OrderStatusError, CurrentActor>;
    readonly getCart: Effect.Effect<CartSnapshot, CartError, CurrentActor>;
    readonly addCartItem: (
      input: OrderItemInput,
    ) => Effect.Effect<CartSnapshot, CartError, CurrentActor>;
    readonly updateCartItem: (
      input: UpdateCartItemRequest,
    ) => Effect.Effect<CartSnapshot, CartError, CurrentActor>;
    readonly removeCartItem: (
      input: CartItemIdRequest,
    ) => Effect.Effect<CartSnapshot, CartError, CurrentActor>;
    readonly clearCart: Effect.Effect<CartSnapshot, CartError, CurrentActor>;
    readonly checkoutCart: (
      input: CheckoutCartRequest,
    ) => Effect.Effect<CoffeeOrder, CartError, CurrentActor>;
    readonly prepareCartCheckout: Effect.Effect<CheckoutSession, CartError, CurrentActor>;
    readonly getCurrentCheckoutSession: Effect.Effect<
      Option.Option<CheckoutSession>,
      AuthenticationRequiredError | InternalAppError,
      CurrentActor
    >;
  }
>()("@effect-coffee-shop/coffee-application/CoffeeOrderApp") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const orders = yield* Order;
      const carts = yield* Cart;
      const summaries = yield* OrderSummary;
      const customerOrders = yield* CustomerOrders;
      const queue = yield* OrderQueue;

      const moveOrder = Effect.fn("CoffeeOrders.changeOrderStatus")(function* (
        orderId: OrderId,
        command: StartBrewing | MarkReady | PickUpOrder | CancelOrder,
      ) {
        const actor = yield* requireStaffActor();
        const attributes = {
          ...actorObservabilityAttributes(actor),
          order_action: "change-status",
          order_id: orderId,
        };
        yield* annotateObservabilitySpan(attributes);
        const { reply } = yield* orders.send(orderId, command).pipe(
          asDomainActor(actor),
          Effect.catchTags({
            StaffOnly: () => Effect.fail(staffRoleRequiredError()),
            OrderNotFound: () => Effect.fail(new OrderNotFoundError({ orderId })),
            InvalidStatusTransition: ({ from, to }) =>
              Effect.fail(new InvalidOrderStatusTransitionError({ orderId, from, to })),
          }),
        );
        yield* logInfoWithAttributes("updated coffee order status", {
          ...attributes,
          order_status: reply.order.status,
        });
        yield* recordOrderAction({
          action: "change-status",
          actor,
          result: "success",
          status: reply.order.status,
        });
        return reply.order;
      });

      const cartOf = Effect.fn("CoffeeOrders.cartOf")(function* () {
        const actor = yield* requireSignedInActor();
        const state = yield* carts.state(actor.userId);
        return { actor, cart: snapshotOf(state) };
      });

      const changeCart = Effect.fn("CoffeeOrders.changeCart")(function* (
        send: (
          actor: AuthenticatedActor,
        ) => Effect.Effect<
          { readonly reply: { readonly cart: DomainCartSnapshot } },
          CartRejection,
          DomainActor
        >,
      ) {
        const actor = yield* requireSignedInActor();
        const { reply } = yield* send(actor).pipe(
          asDomainActor(actor),
          Effect.mapError(fromCartRejection("Unable to save cart right now")),
        );
        return toCartSnapshot(actor, reply.cart);
      });

      return CoffeeOrderApp.of({
        listMenu: Effect.succeed(menuItems),
        getItemOptions: (input) =>
          Effect.fromOption(findMenuItem(input.drinkId)).pipe(
            Effect.mapError(() => new DrinkNotFoundError({ drinkId: input.drinkId })),
            Effect.map((item) => ({
              item,
              availableSizes: drinkSizes,
              defaultSize: "medium" as const,
              defaultMilk: defaultMilkFor(item),
              defaultTemperature: defaultTemperatureFor(item),
              defaultShots: defaultShotsFor(item),
              defaultQuantity,
            })),
          ),
        validateOrder: (input) => quote(input.items),
        quoteOrder: (input) => quote(input.items),
        placeOrder: Effect.fn("CoffeeOrders.placeOrder")(function* (request) {
          const actor = yield* requireSignedInActor();
          yield* annotateObservabilitySpan({
            ...actorObservabilityAttributes(actor),
            order_action: "place",
          });
          const orderId = yield* makeOrderId;
          const { reply } = yield* orders
            .send(
              orderId,
              new PlaceOrder({
                items: request.items,
                ...Option.match(Option.fromUndefinedOr(request.customerName), {
                  onNone: () => ({}),
                  onSome: (customerName) => ({ customerName }),
                }),
              }),
            )
            .pipe(
              asDomainActor(actor),
              Effect.mapError(fromOrderRejection("Unable to place order")),
            );
          yield* logInfoWithAttributes("coffee order placed", {
            ...actorObservabilityAttributes(actor),
            order_action: "place",
            order_id: orderId,
            order_status: reply.order.status,
          });
          yield* recordOrderAction({
            action: "place",
            actor,
            result: "success",
            status: reply.order.status,
          });
          return reply.order;
        }),
        getOrder: Effect.fn("CoffeeOrders.getOrder")(function* (orderId) {
          const actor = yield* requireSignedInActor();
          const summary = yield* summaries
            .query(Order.ref(orderId))
            .pipe(Effect.mapError(internal("Unable to load order right now")));
          return yield* Option.flatMapNullishOr(summary, ({ order }) => order).pipe(
            Option.filter(
              (order) => actor.kind !== "customer" || order.ownerUserId === actor.userId,
            ),
            Effect.fromOption,
            Effect.mapError(() => new OrderNotFoundError({ orderId })),
          );
        }),
        listOrders: Effect.fn("CoffeeOrders.listOrders")(function* (request) {
          const actor = yield* requireSignedInActor();
          const status = yield* Option.match(Option.fromUndefinedOr(request.status), {
            onNone: () => Effect.succeed(Option.none<OrderStatus>()),
            onSome: (requested) =>
              Effect.fromOption(decodeOrderStatus(requested)).pipe(
                Effect.mapError(
                  () =>
                    new InvalidOrderInputError({
                      message: `status "${requested}" is not supported`,
                    }),
                ),
                Effect.asSome,
              ),
          });
          const listed = yield* (
            actor.kind === "customer"
              ? customerOrders.query(Customer.ref(actor.userId))
              : queue.query(Shop.ref(mainShop))
          ).pipe(Effect.mapError(internal("Unable to list orders right now")));
          const all = Option.match(listed, { onNone: () => [], onSome: ({ orders }) => orders });
          yield* recordOrderAction({ action: "list", actor, result: "success" });
          return Option.match(status, {
            onNone: () => all,
            onSome: (wanted) => Arr.filter(all, (order) => order.status === wanted),
          });
        }),
        startBrewing: (orderId) => moveOrder(orderId, new StartBrewing()),
        markReady: (orderId) => moveOrder(orderId, new MarkReady()),
        pickUpOrder: (orderId) => moveOrder(orderId, new PickUpOrder()),
        cancelOrder: (orderId) => moveOrder(orderId, new CancelOrder()),
        getCart: cartOf().pipe(Effect.map(({ actor, cart }) => toCartSnapshot(actor, cart))),
        addCartItem: (input) =>
          changeCart((actor) =>
            Effect.flatMap(makeCartItemId, (cartItemId) =>
              carts.send(actor.userId, new AddCartItem({ cartItemId, item: input })),
            ),
          ),
        updateCartItem: ({ cartItemId, ...changes }) =>
          changeCart((actor) =>
            carts.send(actor.userId, new UpdateCartItem({ cartItemId, changes })),
          ),
        removeCartItem: ({ cartItemId }) =>
          changeCart((actor) => carts.send(actor.userId, new RemoveCartItem({ cartItemId }))),
        clearCart: changeCart((actor) => carts.send(actor.userId, new ClearCart())),
        prepareCartCheckout: Effect.all([requireSignedInActor(), makeCheckoutId], {
          concurrency: 1,
        }).pipe(
          Effect.flatMap(([actor, checkoutId]) =>
            carts.send(actor.userId, new PrepareCheckout({ checkoutId })).pipe(
              asDomainActor(actor),
              Effect.mapError(fromCartRejection("Unable to save checkout session right now")),
              Effect.map(({ reply }) => toCheckoutSession(actor, reply.checkout)),
            ),
          ),
          Effect.withSpan("CoffeeOrders.prepareCartCheckout"),
        ),
        getCurrentCheckoutSession: cartOf().pipe(
          Effect.map(({ actor, cart }) =>
            Option.map(Option.fromNullishOr(cart.checkout), (checkout) =>
              toCheckoutSession(actor, checkout),
            ),
          ),
          Effect.withSpan("CoffeeOrders.getCurrentCheckoutSession"),
        ),
        checkoutCart: Effect.fn("CoffeeOrders.checkoutCart")(function* (input) {
          const actor = yield* requireSignedInActor();
          const orderId = yield* makeOrderId;
          yield* carts
            .send(
              actor.userId,
              new ConfirmCheckout({
                checkoutId: input.checkoutSessionId,
                orderId,
                ...Option.match(Option.fromUndefinedOr(input.customerName), {
                  onNone: () => ({}),
                  onSome: (customerName) => ({ customerName }),
                }),
              }),
            )
            .pipe(asDomainActor(actor), Effect.mapError(fromCartRejection("Unable to check out")));
          // The order is placed by the domain's CheckoutFulfillment policy, just after the commit.
          const placed = yield* summaries
            .waitFor(
              Order.ref(orderId),
              { order: { not: null } },
              { timeout: checkoutPlacementTimeout },
            )
            .pipe(Effect.mapError(internal("The order was confirmed but is not placed yet")));
          return yield* Effect.fromNullishOr(placed.order).pipe(
            Effect.mapError(internal("The order was confirmed but is not placed yet")),
          );
        }),
      });
    }),
  );
}
