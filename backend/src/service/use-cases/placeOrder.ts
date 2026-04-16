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
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
import { type CoffeeOrder } from "#domain/order";
import { AuthenticationRequiredError, requireSignedInActor } from "#service/CurrentActor";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
  logWarnWithAttributes,
} from "#service/observability";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { EmailService } from "../ports/EmailService.ts";
import { type PlaceOrderRequest } from "../contracts.ts";
import type { AppActor } from "#service/CurrentActor";

const dispatchOrderConfirmation = Effect.fnUntraced(function* (
  actor: AppActor,
  order: CoffeeOrder,
) {
  const emailService = yield* EmailService;
  yield* emailService.sendOrderConfirmation(order).pipe(
    Effect.catchTag("EmailError", (error) =>
      logWarnWithAttributes("coffee order confirmation email failed", {
        ...actorObservabilityAttributes(actor),
        order_id: order.id,
        error_message: error.message,
      }),
    ),
  );
});

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
  const selectedMilk = yield* Option.fromNullishOr(milk).pipe(
    Option.match({
      onNone: () => Effect.succeed(defaultMilkFor(menuItem)),
      onSome: (m) =>
        isMilk(m)
          ? Effect.succeed(m)
          : Effect.fail(invalidOrderInput(`milk must be one of: ${availableValues(milks)}`)),
    }),
  );

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
  const selectedTemperature = yield* Option.fromNullishOr(temperature).pipe(
    Option.match({
      onNone: () => Effect.succeed(defaultTemperatureFor(menuItem)),
      onSome: (t) =>
        isTemperature(t)
          ? Effect.succeed(t)
          : Effect.fail(
              invalidOrderInput(`temperature must be one of: ${availableValues(temperatures)}`),
            ),
    }),
  );

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
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository | OrderIdGenerator | OrderRepository | EmailService
> {
  const actor = yield* requireSignedInActor();
  const orderIdGenerator = yield* OrderIdGenerator;
  const menuRepository = yield* MenuRepository;
  const orderRepository = yield* OrderRepository;
  const customerName =
    actor.kind === "system"
      ? yield* validateCustomerName(request.customerName ?? actor.displayName)
      : actor.displayName;

  yield* annotateObservabilitySpan({
    ...actorObservabilityAttributes(actor),
    drink_id: request.drinkId,
    order_action: "place",
  });

  const menuItem = yield* menuRepository.findById(request.drinkId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to place order right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new DrinkNotFoundError({ drinkId: request.drinkId })),
        onSome: Effect.succeed,
      }),
    ),
  );

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
    ownerUserId: actor.userId,
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

  const savedOrder = yield* orderRepository.save(order).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to place order right now")),
    Effect.tap((saved) => dispatchOrderConfirmation(actor, saved)),
  );

  yield* logInfoWithAttributes("coffee order placed", {
    ...actorObservabilityAttributes(actor),
    drink_id: request.drinkId,
    order_action: "place",
    order_id: savedOrder.id,
    order_status: savedOrder.status,
  });

  return savedOrder;
});
