/**
 * Validates, defaults, and prices requested Coffee order items.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Request from "effect/Request";
import * as RequestResolver from "effect/RequestResolver";
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import {
  availableValues,
  calculatePrice,
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  drinkSizes,
  milks,
  temperatures,
  DrinkSizeSchema,
  MilkSchema,
  TemperatureSchema,
  type DrinkSize,
  type MenuItem,
  type Milk,
  type Temperature,
} from "@effect-coffee-shop/coffee-core/domain/menu";
import { multiplyMoney, sumMoney } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  QuantitySchema,
  ShotCountSchema,
  type Quantity,
  type ShotCount,
} from "@effect-coffee-shop/coffee-core/domain/order-primitives";
import {
  CoffeeOrderItemSchema,
  type CoffeeOrderItem,
} from "@effect-coffee-shop/coffee-core/domain/order";
import type { OrderItemInput, OrderQuote } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";

const defaultQuantity = 1;
const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);
const decodeDrinkSize = Schema.decodeUnknownEffect(DrinkSizeSchema);
const decodeMilk = Schema.decodeUnknownEffect(MilkSchema);
const decodeQuantity = Schema.decodeUnknownEffect(QuantitySchema);
const decodeShotCount = Schema.decodeUnknownEffect(ShotCountSchema);
const decodeTemperature = Schema.decodeUnknownEffect(TemperatureSchema);
const decodeResolvedItems = Schema.decodeUnknownEffect(
  Schema.NonEmptyArray(Schema.toType(CoffeeOrderItemSchema)),
);
type OrderItemResolutionError = DrinkNotFoundError | InvalidOrderInputError | InternalAppError;

class ResolveOrderItemRequest extends Request.TaggedClass("ResolveOrderItemRequest")<
  {
    readonly input: OrderItemInput;
  },
  CoffeeOrderItem,
  OrderItemResolutionError
> {}

const trimmedOption = (value: string | undefined): Option.Option<string> =>
  Option.fromUndefinedOr(value).pipe(
    Option.map(decodeTrimmedString),
    Option.filter((input) => input.length > 0),
  );

export const invalidOrderInput = (message: string) => new InvalidOrderInputError({ message });

const validateSize = Effect.fn("orderItems.validateSize")(function* (
  size: string,
): Effect.fn.Return<DrinkSize, InvalidOrderInputError> {
  return yield* decodeDrinkSize(size).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput(`size must be one of: ${availableValues(drinkSizes)}`)),
    ),
  );
});

const resolveMilk = Effect.fn("orderItems.resolveMilk")(function* (
  menuItem: MenuItem,
  milk: string | undefined,
): Effect.fn.Return<Milk, InvalidOrderInputError> {
  const selectedMilk = yield* Option.fromNullishOr(milk).pipe(
    Option.match({
      onNone: () => Effect.succeed(defaultMilkFor(menuItem)),
      onSome: (m) =>
        decodeMilk(m).pipe(
          Effect.catchTag("SchemaError", () =>
            Effect.fail(invalidOrderInput(`milk must be one of: ${availableValues(milks)}`)),
          ),
        ),
    }),
  );

  return yield* Effect.succeed(selectedMilk).pipe(
    Effect.filterOrFail(
      (milk) => menuItem.availableMilks.some((availableMilk) => availableMilk === milk),
      (milk) => invalidOrderInput(`${menuItem.name} does not support milk option "${milk}"`),
    ),
  );
});

const resolveTemperature = Effect.fn("orderItems.resolveTemperature")(function* (
  menuItem: MenuItem,
  temperature: string | undefined,
): Effect.fn.Return<Temperature, InvalidOrderInputError> {
  const selectedTemperature = yield* Option.fromNullishOr(temperature).pipe(
    Option.match({
      onNone: () => Effect.succeed(defaultTemperatureFor(menuItem)),
      onSome: (t) =>
        decodeTemperature(t).pipe(
          Effect.catchTag("SchemaError", () =>
            Effect.fail(
              invalidOrderInput(`temperature must be one of: ${availableValues(temperatures)}`),
            ),
          ),
        ),
    }),
  );

  return yield* Effect.succeed(selectedTemperature).pipe(
    Effect.filterOrFail(
      (temperature) =>
        menuItem.availableTemperatures.some(
          (availableTemperature) => availableTemperature === temperature,
        ),
      (temperature) =>
        invalidOrderInput(`${menuItem.name} does not support temperature "${temperature}"`),
    ),
  );
});

const resolveShots = Effect.fn("orderItems.resolveShots")(function* (
  menuItem: MenuItem,
  shots: number | undefined,
): Effect.fn.Return<ShotCount, InvalidOrderInputError> {
  const selectedShots = shots ?? defaultShotsFor(menuItem);

  const shotCount = yield* decodeShotCount(selectedShots).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("shots must be a non-negative integer")),
    ),
  );

  return yield* Effect.succeed(shotCount).pipe(
    Effect.filterOrFail(
      (shotCount) => menuItem.kind !== "tea" || shotCount === 0,
      () => invalidOrderInput("Tea drinks do not support extra shots"),
    ),
    Effect.filterOrFail(
      (shotCount) => shotCount <= menuItem.maxShots,
      () => invalidOrderInput(`${menuItem.name} supports at most ${menuItem.maxShots} shot(s)`),
    ),
  );
});

const resolveQuantity = Effect.fn("orderItems.resolveQuantity")(function* (
  quantity: number | undefined,
): Effect.fn.Return<Quantity, InvalidOrderInputError> {
  const selectedQuantity = quantity ?? defaultQuantity;

  return yield* decodeQuantity(selectedQuantity).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("quantity must be a positive integer")),
    ),
  );
});

const findMenuItem = Effect.fn("orderItems.findMenuItem")(function* (
  drinkId: string,
): Effect.fn.Return<MenuItem, DrinkNotFoundError | InternalAppError, MenuRepository> {
  const menuRepository = yield* MenuRepository;

  return yield* menuRepository.findById(drinkId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load menu item right now")),
    Effect.flatMap((item) => Effect.fromOption(item, () => new DrinkNotFoundError({ drinkId }))),
  );
});

export const resolveOrderItem = Effect.fn("orderItems.resolveOrderItem")(function* (
  request: OrderItemInput,
): Effect.fn.Return<
  CoffeeOrderItem,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  const menuItem = yield* findMenuItem(request.drinkId);
  const size = yield* validateSize(request.size);
  const milk = yield* resolveMilk(menuItem, request.milk);
  const temperature = yield* resolveTemperature(menuItem, request.temperature);
  const shots = yield* resolveShots(menuItem, request.shots);
  const quantity = yield* resolveQuantity(request.quantity);
  const unitPrice = calculatePrice(menuItem, size, shots);
  const lineTotal = multiplyMoney(unitPrice, quantity);
  const notes = trimmedOption(request.notes);

  return {
    drinkId: menuItem.id,
    drinkName: menuItem.name,
    size,
    milk,
    temperature,
    shots,
    quantity,
    unitPrice,
    lineTotal,
    notes,
  };
});

export const resolveOrderItems = Effect.fn("orderItems.resolveOrderItems")(function* (
  items: readonly OrderItemInput[],
): Effect.fn.Return<readonly CoffeeOrderItem[], OrderItemResolutionError, MenuRepository> {
  const menuRepository = yield* MenuRepository;
  const resolver = yield* RequestResolver.fromEffect(
    (entry: Request.Entry<ResolveOrderItemRequest>) =>
      resolveOrderItem(entry.request.input).pipe(
        Effect.provideService(MenuRepository, menuRepository),
      ),
  ).pipe(RequestResolver.withCache({ capacity: 128 }));

  return yield* Effect.forEach(
    items,
    (input) => Effect.request(new ResolveOrderItemRequest({ input }), resolver),
    { concurrency: "unbounded" },
  );
});

export const resolveOrderQuote = Effect.fn("orderItems.resolveOrderQuote")(function* (
  items: readonly OrderItemInput[],
): Effect.fn.Return<
  OrderQuote,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  yield* Effect.succeed(items).pipe(
    Effect.filterOrFail(
      (inputItems) => inputItems.length > 0,
      () => invalidOrderInput("items must include at least one drink"),
    ),
  );

  const resolvedItemArray = yield* resolveOrderItems(items);
  const resolvedItems = yield* decodeResolvedItems(resolvedItemArray).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("items must include at least one drink")),
    ),
  );

  return {
    items: resolvedItems,
    totalPrice: sumMoney(resolvedItems.map((item) => item.lineTotal)),
  };
});

export const toOrderItemInput = (item: {
  readonly drinkId: string;
  readonly milk: Option.Option<string>;
  readonly notes: Option.Option<string>;
  readonly quantity: number;
  readonly shots: Option.Option<number>;
  readonly size: string;
  readonly temperature: Option.Option<string>;
}): OrderItemInput => ({
  drinkId: item.drinkId,
  size: item.size,
  quantity: item.quantity,
  ...Option.match(item.milk, {
    onNone: () => ({}),
    onSome: (milk) => ({ milk }),
  }),
  ...Option.match(item.temperature, {
    onNone: () => ({}),
    onSome: (temperature) => ({ temperature }),
  }),
  ...Option.match(item.shots, {
    onNone: () => ({}),
    onSome: (shots) => ({ shots }),
  }),
  ...Option.match(item.notes, {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});
