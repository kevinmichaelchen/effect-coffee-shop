import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { DrinkNotFoundError, InvalidOrderInputError } from "#domain/errors";
import {
  availableValues,
  calculatePriceCents,
  defaultMilkFor,
  defaultShotsFor,
  defaultTemperatureFor,
  drinkSizes,
  isDrinkSize,
  isMilk,
  isTemperature,
  milks,
  temperatures,
  type MenuItem,
  type DrinkSize,
  type Milk,
  type Temperature,
} from "#domain/menu";
import { type CoffeeOrder, type PlaceOrderRequest } from "#domain/order";
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
};

const invalidOrderInput = (message: string) => new InvalidOrderInputError({ message });

const validateCustomerName = Effect.fnUntraced(function* (
  customerName: string,
): Effect.fn.Return<string, InvalidOrderInputError> {
  const trimmedCustomerName = customerName.trim();
  if (trimmedCustomerName.length === 0) {
    return yield* invalidOrderInput("customerName must not be blank");
  }
  return trimmedCustomerName;
});

const validateSize = Effect.fnUntraced(function* (
  size: string,
): Effect.fn.Return<DrinkSize, InvalidOrderInputError> {
  if (!isDrinkSize(size)) {
    return yield* invalidOrderInput(`size must be one of: ${availableValues(drinkSizes)}`);
  }
  return size;
});

const resolveMilk = Effect.fnUntraced(function* (
  menuItem: MenuItem,
  milk: string | undefined,
): Effect.fn.Return<Milk, InvalidOrderInputError> {
  const selectedMilk =
    milk === undefined
      ? defaultMilkFor(menuItem)
      : isMilk(milk)
        ? milk
        : yield* invalidOrderInput(`milk must be one of: ${availableValues(milks)}`);

  if (!menuItem.availableMilks.some((availableMilk) => availableMilk === selectedMilk)) {
    return yield* invalidOrderInput(
      `${menuItem.name} does not support milk option "${selectedMilk}"`,
    );
  }

  return selectedMilk;
});

const resolveTemperature = Effect.fnUntraced(function* (
  menuItem: MenuItem,
  temperature: string | undefined,
): Effect.fn.Return<Temperature, InvalidOrderInputError> {
  const selectedTemperature =
    temperature === undefined
      ? defaultTemperatureFor(menuItem)
      : isTemperature(temperature)
        ? temperature
        : yield* invalidOrderInput(`temperature must be one of: ${availableValues(temperatures)}`);

  if (
    !menuItem.availableTemperatures.some(
      (availableTemperature) => availableTemperature === selectedTemperature,
    )
  ) {
    return yield* invalidOrderInput(
      `${menuItem.name} does not support temperature "${selectedTemperature}"`,
    );
  }

  return selectedTemperature;
});

const resolveShots = Effect.fnUntraced(function* (
  menuItem: MenuItem,
  shots: number | undefined,
): Effect.fn.Return<number, InvalidOrderInputError> {
  const selectedShots = shots ?? defaultShotsFor(menuItem);

  if (!Number.isInteger(selectedShots) || selectedShots < 0) {
    return yield* invalidOrderInput("shots must be a non-negative integer");
  }

  if (menuItem.kind === "tea" && selectedShots > 0) {
    return yield* invalidOrderInput("Tea drinks do not support extra shots");
  }

  if (selectedShots > menuItem.maxShots) {
    return yield* invalidOrderInput(
      `${menuItem.name} supports at most ${menuItem.maxShots} shot(s)`,
    );
  }

  return selectedShots;
});

export const placeOrder = Effect.fn("CoffeeOrders.placeOrder")(function* (
  request: PlaceOrderRequest,
): Effect.fn.Return<
  CoffeeOrder,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository | OrderIdGenerator | OrderRepository
> {
  const orderIdGenerator = yield* OrderIdGenerator;
  const menuRepository = yield* MenuRepository;
  const orderRepository = yield* OrderRepository;

  const customerName = yield* validateCustomerName(request.customerName);

  const maybeMenuItem = yield* menuRepository.findById(request.drinkId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to place order right now")),
  );
  if (Option.isNone(maybeMenuItem)) {
    return yield* new DrinkNotFoundError({
      drinkId: request.drinkId,
    });
  }
  const menuItem = maybeMenuItem.value;

  const size = yield* validateSize(request.size);
  const milk = yield* resolveMilk(menuItem, request.milk);
  const temperature = yield* resolveTemperature(menuItem, request.temperature);
  const shots = yield* resolveShots(menuItem, request.shots);

  const id = yield* orderIdGenerator.next;
  const createdAt = yield* DateTime.now;
  const notes = trimmedOrUndefined(request.notes);

  const order: CoffeeOrder = {
    id,
    customerName,
    drinkId: menuItem.id,
    drinkName: menuItem.name,
    size,
    milk,
    temperature,
    shots,
    status: "pending",
    priceCents: calculatePriceCents(menuItem, size, shots),
    createdAt,
    ...(notes === undefined ? {} : { notes }),
  };

  return yield* orderRepository.save(order).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to place order right now")),
  );
});
