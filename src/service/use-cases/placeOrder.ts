import * as Effect from "effect/Effect";
import { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
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
  type DrinkSize,
  type Milk,
  type Temperature,
} from "../../domain/menu.ts";
import { type CoffeeOrder, type PlaceOrderRequest } from "../../domain/order.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";

const trimmedOrUndefined = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const placeOrder = Effect.fn("CoffeeOrders.placeOrder")(function* (
  request: PlaceOrderRequest,
): Effect.fn.Return<
  CoffeeOrder,
  DrinkNotFoundError | InvalidOrderInputError,
  MenuRepository | OrderRepository
> {
  const menuRepository = yield* MenuRepository;
  const orderRepository = yield* OrderRepository;

  const customerName = request.customerName.trim();
  if (customerName.length === 0) {
    return yield* new InvalidOrderInputError({
      message: "customerName must not be blank",
    });
  }

  const menuItem = yield* menuRepository.findById(request.drinkId);
  if (menuItem === undefined) {
    return yield* new DrinkNotFoundError({
      drinkId: request.drinkId,
    });
  }

  if (!isDrinkSize(request.size)) {
    return yield* new InvalidOrderInputError({
      message: `size must be one of: ${availableValues(drinkSizes)}`,
    });
  }
  const size: DrinkSize = request.size;

  let milk: Milk = defaultMilkFor(menuItem);
  if (request.milk !== undefined) {
    if (!isMilk(request.milk)) {
      return yield* new InvalidOrderInputError({
        message: `milk must be one of: ${availableValues(milks)}`,
      });
    }
    milk = request.milk;
  }

  if (!menuItem.availableMilks.some((availableMilk) => availableMilk === milk)) {
    return yield* new InvalidOrderInputError({
      message: `${menuItem.name} does not support milk option "${milk}"`,
    });
  }

  let temperature: Temperature = defaultTemperatureFor(menuItem);
  if (request.temperature !== undefined) {
    if (!isTemperature(request.temperature)) {
      return yield* new InvalidOrderInputError({
        message: `temperature must be one of: ${availableValues(temperatures)}`,
      });
    }
    temperature = request.temperature;
  }

  if (
    !menuItem.availableTemperatures.some(
      (availableTemperature) => availableTemperature === temperature,
    )
  ) {
    return yield* new InvalidOrderInputError({
      message: `${menuItem.name} does not support temperature "${temperature}"`,
    });
  }

  const shots = request.shots ?? defaultShotsFor(menuItem);
  if (!Number.isInteger(shots) || shots < 0) {
    return yield* new InvalidOrderInputError({
      message: "shots must be a non-negative integer",
    });
  }

  if (menuItem.kind === "tea" && shots > 0) {
    return yield* new InvalidOrderInputError({
      message: "Tea drinks do not support extra shots",
    });
  }

  if (shots > menuItem.maxShots) {
    return yield* new InvalidOrderInputError({
      message: `${menuItem.name} supports at most ${menuItem.maxShots} shot(s)`,
    });
  }

  const id = yield* orderRepository.nextId;
  const createdAt = yield* Effect.sync(() => new Date().toISOString());
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

  return yield* orderRepository.save(order);
});
