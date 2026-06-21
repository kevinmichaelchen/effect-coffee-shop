/**
 * Resolves one requested Coffee order item against menu capabilities.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { calculatePrice, type MenuItem } from "@effect-coffee-shop/coffee-core/domain/menu";
import { multiplyMoney } from "@effect-coffee-shop/coffee-core/domain/money";
import type { CoffeeOrderItem } from "@effect-coffee-shop/coffee-core/domain/order";
import type { OrderItemInput } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import {
  resolveMilk,
  resolveQuantity,
  resolveShots,
  resolveTemperature,
  validateSize,
} from "./orderItemOptions.ts";

const decodeTrimmedString = Schema.decodeUnknownSync(Schema.Trim);

const trimmedOption = (value: string | undefined): Option.Option<string> =>
  Option.fromUndefinedOr(value).pipe(
    Option.map(decodeTrimmedString),
    Option.filter((input) => input.length > 0),
  );

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
