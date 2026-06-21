/**
 * Resolves requested Coffee item options against menu capabilities.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { InvalidOrderInputError } from "@effect-coffee-shop/coffee-core/domain/errors";
import {
  availableValues,
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
import {
  QuantitySchema,
  ShotCountSchema,
  type Quantity,
  type ShotCount,
} from "@effect-coffee-shop/coffee-core/domain/order-primitives";

const defaultQuantity = 1;
const decodeDrinkSize = Schema.decodeUnknownEffect(DrinkSizeSchema);
const decodeMilk = Schema.decodeUnknownEffect(MilkSchema);
const decodeQuantity = Schema.decodeUnknownEffect(QuantitySchema);
const decodeShotCount = Schema.decodeUnknownEffect(ShotCountSchema);
const decodeTemperature = Schema.decodeUnknownEffect(TemperatureSchema);

export const invalidOrderInput = (message: string) => new InvalidOrderInputError({ message });

export const validateSize = Effect.fnUntraced(function* (
  size: string,
): Effect.fn.Return<DrinkSize, InvalidOrderInputError> {
  return yield* decodeDrinkSize(size).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput(`size must be one of: ${availableValues(drinkSizes)}`)),
    ),
  );
});

export const resolveMilk = Effect.fnUntraced(function* (
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
      (resolvedMilk) =>
        menuItem.availableMilks.some((availableMilk) => availableMilk === resolvedMilk),
      (resolvedMilk) =>
        invalidOrderInput(`${menuItem.name} does not support milk option "${resolvedMilk}"`),
    ),
  );
});

export const resolveTemperature = Effect.fnUntraced(function* (
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
      (resolvedTemperature) =>
        menuItem.availableTemperatures.some(
          (availableTemperature) => availableTemperature === resolvedTemperature,
        ),
      (resolvedTemperature) =>
        invalidOrderInput(`${menuItem.name} does not support temperature "${resolvedTemperature}"`),
    ),
  );
});

export const resolveShots = Effect.fnUntraced(function* (
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
      (resolvedShotCount) => menuItem.kind !== "tea" || resolvedShotCount === 0,
      () => invalidOrderInput("Tea drinks do not support extra shots"),
    ),
    Effect.filterOrFail(
      (resolvedShotCount) => resolvedShotCount <= menuItem.maxShots,
      () => invalidOrderInput(`${menuItem.name} supports at most ${menuItem.maxShots} shot(s)`),
    ),
  );
});

export const resolveQuantity = Effect.fnUntraced(function* (
  quantity: number | undefined,
): Effect.fn.Return<Quantity, InvalidOrderInputError> {
  const selectedQuantity = quantity ?? defaultQuantity;

  return yield* decodeQuantity(selectedQuantity).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("quantity must be a positive integer")),
    ),
  );
});
