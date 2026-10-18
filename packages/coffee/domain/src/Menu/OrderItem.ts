/**
 * Prices drink requests against the menu. Pure, so an aggregate's `decide`
 * can price a request and reject it in the same step.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import { Money, multiplyMoney, sumMoney } from "../Money.ts";
import { DrinkNotFound } from "./DrinkNotFound.rejection.ts";
import { InvalidOrder } from "./InvalidOrder.rejection.ts";
import {
  availableValues,
  calculatePrice,
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  DrinkId,
  DrinkSize,
  drinkSizes,
  findMenuItem,
  type MenuItem,
  Milk,
  milks,
  Temperature,
  temperatures,
} from "./Menu.ts";
import { Quantity, QuantityInput, ShotCount, ShotCountInput } from "./OrderPrimitives.ts";

// Menu choices stay trimmed strings on the wire, so a bad choice is refused
// with a rejection that names the menu rule instead of a schema error.
const Choice = Schema.Trim;

/** One drink as a client asks for it: menu choices, with defaults for what it leaves out. */
export const DrinkSelection = Schema.Struct({
  drinkId: Choice.annotate({ description: "Menu drink id such as latte." }),
  size: Choice.annotate({ description: "Drink size such as small, medium, or large." }),
  milk: Schema.optionalKey(
    Choice.annotate({ description: "Milk choice such as whole, oat, almond, or none." }),
  ),
  temperature: Schema.optionalKey(
    Choice.annotate({ description: "Drink temperature such as hot or iced." }),
  ),
  shots: Schema.optionalKey(ShotCountInput.annotate({ description: "Number of espresso shots." })),
  notes: Schema.optionalKey(Choice.annotate({ description: "Optional item note." })),
  quantity: Schema.optionalKey(QuantityInput.annotate({ description: "Positive line quantity." })),
}).annotate({ identifier: "DrinkSelection" });
export type DrinkSelection = typeof DrinkSelection.Type;

/** Changes to a requested drink: only the choices given change. */
export const DrinkSelectionChanges = Schema.Struct({
  ...DrinkSelection.fields,
  drinkId: Schema.optionalKey(DrinkSelection.fields.drinkId),
  size: Schema.optionalKey(DrinkSelection.fields.size),
}).annotate({ identifier: "DrinkSelectionChanges" });
export type DrinkSelectionChanges = typeof DrinkSelectionChanges.Type;

/** One priced line: the drink, every choice resolved, and its prices. */
export const CoffeeOrderItem = Schema.Struct({
  drinkId: DrinkId,
  drinkName: Schema.String,
  size: DrinkSize,
  milk: Milk,
  temperature: Temperature,
  shots: ShotCount,
  notes: Schema.OptionFromOptionalKey(Schema.String),
  quantity: Quantity,
  unitPrice: Money,
  lineTotal: Money,
}).annotate({ identifier: "CoffeeOrderItem" });
export type CoffeeOrderItem = typeof CoffeeOrderItem.Type;

/** Priced lines and their total. */
export const OrderQuote = Schema.Struct({
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  totalPrice: Money,
}).annotate({ identifier: "OrderQuote" });
export type OrderQuote = typeof OrderQuote.Type;

export type PricingFailure = DrinkNotFound | InvalidOrder;

const invalid = (message: string) => new InvalidOrder({ message });

const decodeSize = Schema.decodeUnknownOption(DrinkSize);
const decodeMilk = Schema.decodeUnknownOption(Milk);
const decodeTemperature = Schema.decodeUnknownOption(Temperature);
const decodeShots = Schema.decodeUnknownOption(ShotCount);
const decodeQuantity = Schema.decodeUnknownOption(Quantity);

const choose = <A>(
  requested: Option.Option<string>,
  decode: (input: string) => Option.Option<A>,
  fallback: () => A,
  unknownMessage: string,
): Result.Result<A, InvalidOrder> =>
  Option.match(requested, {
    onNone: () => Result.succeed(fallback()),
    onSome: (choice) => Result.fromOption(decode(choice), () => invalid(unknownMessage)),
  });

const supported = <A>(
  value: A,
  available: ReadonlyArray<A>,
  message: string,
): Result.Result<A, InvalidOrder> =>
  available.includes(value) ? Result.succeed(value) : Result.fail(invalid(message));

const resolveShots = (
  item: MenuItem,
  requested: Option.Option<number>,
): Result.Result<ShotCount, InvalidOrder> =>
  Result.fromOption(decodeShots(Option.getOrElse(requested, () => defaultShotsFor(item))), () =>
    invalid("shots must be a non-negative integer"),
  ).pipe(
    Result.flatMap((shots) =>
      item.kind === "tea" && shots !== 0
        ? Result.fail(invalid("Tea drinks do not support extra shots"))
        : Result.succeed(shots),
    ),
    Result.flatMap((shots) =>
      shots > item.maxShots
        ? Result.fail(invalid(`${item.name} supports at most ${item.maxShots} shot(s)`))
        : Result.succeed(shots),
    ),
  );

const trimmedNote = (notes: Option.Option<string>): Option.Option<string> =>
  notes.pipe(
    Option.map((note) => note.trim()),
    Option.filter((note) => note !== ""),
  );

/** Resolve one request against the menu: defaults filled in, every choice checked, priced. */
export const priceOrderItem = (
  request: DrinkSelection,
): Result.Result<CoffeeOrderItem, PricingFailure> =>
  Result.gen(function* () {
    const item = yield* Result.fromOption(
      findMenuItem(request.drinkId),
      () => new DrinkNotFound({ drinkId: request.drinkId }),
    );
    const size = yield* Result.fromOption(decodeSize(request.size), () =>
      invalid(`size must be one of: ${availableValues(drinkSizes)}`),
    );
    const milk = yield* choose(
      Option.fromUndefinedOr(request.milk),
      decodeMilk,
      () => defaultMilkFor(item),
      `milk must be one of: ${availableValues(milks)}`,
    ).pipe(
      Result.flatMap((milk) =>
        supported(milk, item.availableMilks, `${item.name} does not support milk option "${milk}"`),
      ),
    );
    const temperature = yield* choose(
      Option.fromUndefinedOr(request.temperature),
      decodeTemperature,
      () => defaultTemperatureFor(item),
      `temperature must be one of: ${availableValues(temperatures)}`,
    ).pipe(
      Result.flatMap((temperature) =>
        supported(
          temperature,
          item.availableTemperatures,
          `${item.name} does not support temperature "${temperature}"`,
        ),
      ),
    );
    const shots = yield* resolveShots(item, Option.fromUndefinedOr(request.shots));
    const quantity = yield* Result.fromOption(decodeQuantity(request.quantity ?? 1), () =>
      invalid("quantity must be a positive integer"),
    );
    const unitPrice = calculatePrice(item, size, shots);
    return {
      drinkId: item.id,
      drinkName: item.name,
      size,
      milk,
      temperature,
      shots,
      notes: trimmedNote(Option.fromUndefinedOr(request.notes)),
      quantity,
      unitPrice,
      lineTotal: multiplyMoney(unitPrice, quantity),
    };
  });

/** Price every request; an order needs at least one drink. */
export const quoteOrder = (
  requests: ReadonlyArray<DrinkSelection>,
): Result.Result<OrderQuote, PricingFailure> =>
  Result.gen(function* () {
    const priced = yield* Result.all(Arr.map(requests, priceOrderItem));
    const items = yield* Arr.isReadonlyArrayNonEmpty(priced)
      ? Result.succeed(priced)
      : Result.fail(invalid("items must include at least one drink"));
    return { items, totalPrice: totalOf(items) };
  });

export const totalOf = (items: ReadonlyArray<CoffeeOrderItem>): Money =>
  sumMoney(Arr.map(items, (item) => item.lineTotal));

/** The request that reproduces a priced line, so it can be re-priced later. */
export const toDrinkSelection = (item: CoffeeOrderItem): DrinkSelection => ({
  drinkId: item.drinkId,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  ...Option.match(item.notes, { onNone: () => ({}), onSome: (notes) => ({ notes }) }),
});
