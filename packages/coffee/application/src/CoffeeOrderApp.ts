/**
 * Serves the hand-written Coffee adapters (the MCP menu tools, resources and
 * prompts) from the domain model: the static menu and its pricing, and reads
 * of orders from views. Domain rejections are translated into the adapters'
 * error types here. Orders, carts, checkout and the staff lifecycle are not
 * here: adapters reach them through the domain Apis.
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
import {
  type PricingFailure,
  quoteOrder as priceOrder,
} from "@effect-coffee-shop/coffee-domain/Menu/OrderItem";
import { Quantity } from "@effect-coffee-shop/coffee-domain/Menu/OrderPrimitives";
import type { CoffeeOrder } from "@effect-coffee-shop/coffee-domain/Order/CoffeeOrder";
import { CustomerOrders } from "@effect-coffee-shop/coffee-domain/Order/CustomerOrders.view";
import { Order } from "@effect-coffee-shop/coffee-domain/Order/Order.aggregate";
import type { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { OrderQueue } from "@effect-coffee-shop/coffee-domain/Order/OrderQueue.view";
import { OrderStatus } from "@effect-coffee-shop/coffee-domain/Order/OrderStatus";
import { OrderSummary } from "@effect-coffee-shop/coffee-domain/Order/OrderSummary.view";
import { mainShop } from "@effect-coffee-shop/coffee-domain/Shop/Shop.id";
import type {
  ItemOptions,
  ItemOptionsRequest,
  ListOrdersRequest,
  OrderItemInput,
  OrderQuote,
  QuoteOrderRequest,
} from "./contracts.ts";
import {
  type AuthenticationRequiredError,
  type CurrentActor,
  requireSignedInActor,
} from "./CurrentActor.ts";
import {
  DrinkNotFoundError,
  InternalAppError,
  InvalidOrderInputError,
  OrderNotFoundError,
} from "./errors.ts";
import { recordOrderAction } from "./observability.ts";

type OrderInputError = DrinkNotFoundError | InvalidOrderInputError | InternalAppError;

const defaultQuantity = Schema.decodeSync(Quantity)(1);
const decodeOrderStatus = Schema.decodeUnknownOption(OrderStatus);

const internal = (message: string) => (cause: unknown) => new InternalAppError({ message, cause });

/** Translate the rejections pricing an order can meet into adapter errors. */
const fromPricingFailure = (failure: PricingFailure): OrderInputError =>
  Match.value(failure).pipe(
    Match.tagsExhaustive({
      DrinkNotFound: ({ drinkId }) => new DrinkNotFoundError({ drinkId }),
      InvalidOrder: (invalid) => new InvalidOrderInputError({ message: invalid.message }),
    }),
  );

const quote = (items: ReadonlyArray<OrderItemInput>) =>
  Effect.fromResult(priceOrder(items)).pipe(Effect.mapError(fromPricingFailure));

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
  }
>()("@effect-coffee-shop/coffee-application/CoffeeOrderApp") {
  static readonly layer = Layer.effect(
    this,
    Effect.gen(function* () {
      const summaries = yield* OrderSummary;
      const customerOrders = yield* CustomerOrders;
      const queue = yield* OrderQueue;

      return CoffeeOrderApp.of({
        listMenu: Effect.succeed(menuItems),
        getItemOptions: (input) =>
          Effect.fromOption(findMenuItem(input.drinkId)).pipe(
            Effect.mapBoth({
              onFailure: () => new DrinkNotFoundError({ drinkId: input.drinkId }),
              onSuccess: (item) => ({
                item,
                availableSizes: drinkSizes,
                defaultSize: "medium" as const,
                defaultMilk: defaultMilkFor(item),
                defaultTemperature: defaultTemperatureFor(item),
                defaultShots: defaultShotsFor(item),
                defaultQuantity,
              }),
            }),
          ),
        validateOrder: (input) => quote(input.items),
        quoteOrder: (input) => quote(input.items),
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
              : queue.query(mainShop)
          ).pipe(Effect.mapError(internal("Unable to list orders right now")));
          const all = Option.match(listed, { onNone: () => [], onSome: ({ orders }) => orders });
          yield* recordOrderAction({ action: "list", actor, result: "success" });
          return Option.match(status, {
            onNone: () => all,
            onSome: (wanted) => Arr.filter(all, (order) => order.status === wanted),
          });
        }),
      });
    }),
  );
}
