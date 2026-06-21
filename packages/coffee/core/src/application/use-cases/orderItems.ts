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
import { calculatePrice, type MenuItem } from "@effect-coffee-shop/coffee-core/domain/menu";
import { multiplyMoney, sumMoney } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  CoffeeOrderItemSchema,
  type CoffeeOrderItem,
} from "@effect-coffee-shop/coffee-core/domain/order";
import type { OrderItemInput, OrderQuote } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import {
  invalidOrderInput,
  resolveMilk,
  resolveQuantity,
  resolveShots,
  resolveTemperature,
  validateSize,
} from "./orderItemOptions.ts";

const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);
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

export { invalidOrderInput } from "./orderItemOptions.ts";

const findMenuItem = Effect.fnUntraced(function* (
  drinkId: string,
): Effect.fn.Return<MenuItem, DrinkNotFoundError | InternalAppError, MenuRepository> {
  const menuRepository = yield* MenuRepository;

  return yield* menuRepository.findById(drinkId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load menu item right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new DrinkNotFoundError({ drinkId })),
        onSome: Effect.succeed,
      }),
    ),
  );
});

export const resolveOrderItem = Effect.fnUntraced(function* (
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

export const resolveOrderItems = Effect.fnUntraced(function* (
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

export const resolveOrderQuote = Effect.fnUntraced(function* (
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
