/**
 * Serves the hand-written Coffee adapters (the MCP menu tools, resources and
 * prompts) from the domain model: the static menu, its pricing, and the
 * options one drink offers. Domain rejections are translated into the
 * adapters' error types here. Orders, carts, checkout and the staff lifecycle
 * are not here: adapters reach them through the domain Apis.
 *
 * @module
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
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
import type { QuantityInput } from "@effect-coffee-shop/coffee-domain/Menu/OrderPrimitives";
import type {
  ItemOptions,
  ItemOptionsRequest,
  OrderItemInput,
  OrderQuote,
  QuoteOrderRequest,
} from "./contracts.ts";
import { DrinkNotFoundError, InvalidOrderInputError } from "./errors.ts";
import type { InternalAppError } from "./errors.ts";

type OrderInputError = DrinkNotFoundError | InvalidOrderInputError | InternalAppError;

const defaultQuantity: QuantityInput = 1;

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
    readonly quoteOrder: (input: QuoteOrderRequest) => Effect.Effect<OrderQuote, OrderInputError>;
  }
>()("@effect-coffee-shop/coffee-application/CoffeeOrderApp") {
  static readonly layer = Layer.succeed(
    this,
    this.of({
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
      quoteOrder: (input) => quote(input.items),
    }),
  );
}
