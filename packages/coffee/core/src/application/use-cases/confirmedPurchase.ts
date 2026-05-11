import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import type { PendingOrderConfirmation } from "@effect-coffee-shop/coffee-core/domain/pending-order-confirmation";
import type { CoffeeOrder } from "../../domain/order.ts";
import {
  AuthenticationRequiredError,
  requireSignedInActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  type ConfirmedCheckoutCartRequest,
  type ConfirmedPlaceOrderRequest,
  OrderItemsInputSchema,
  toOrderQuoteView,
} from "../contracts.ts";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { PendingOrderConfirmationRepository } from "../ports/PendingOrderConfirmationRepository.ts";
import { checkoutCart } from "./cart.ts";
import { invalidOrderInput, resolveOrderQuote, toOrderItemInput } from "./orderItems.ts";
import { placeOrder } from "./placeOrder.ts";

const decodeOrderItemsInput = Schema.decodeUnknownEffect(OrderItemsInputSchema);

const loadPendingConfirmation = Effect.fnUntraced(function* (): Effect.fn.Return<
  PendingOrderConfirmation,
  AuthenticationRequiredError | InvalidOrderInputError | InternalAppError,
  PendingOrderConfirmationRepository
> {
  const actor = yield* requireSignedInActor();
  const repository = yield* PendingOrderConfirmationRepository;
  return yield* repository.getByOwnerUserId(actor.userId).pipe(
    Effect.mapError(
      internalAppErrorFromPersistence("Unable to load pending order confirmation right now"),
    ),
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(invalidOrderInput("confirm the interpreted order before placing it")),
        onSome: Effect.succeed,
      }),
    ),
  );
});

const assertPendingSource = Effect.fnUntraced(function* (
  confirmation: PendingOrderConfirmation,
  source: PendingOrderConfirmation["source"],
): Effect.fn.Return<PendingOrderConfirmation, InvalidOrderInputError> {
  return yield* Effect.succeed(confirmation).pipe(
    Effect.filterOrFail(
      (pending) => pending.source === source,
      () => invalidOrderInput("confirm the updated order before placing it"),
    ),
  );
});

const assertPendingConfirmationId = Effect.fnUntraced(function* (
  confirmation: PendingOrderConfirmation,
  confirmationId: PendingOrderConfirmation["confirmationId"],
): Effect.fn.Return<void, InvalidOrderInputError> {
  yield* Effect.succeed(confirmation.confirmationId === confirmationId).pipe(
    Effect.filterOrFail(
      (matches) => matches,
      () => invalidOrderInput("confirm the updated order before placing it"),
    ),
    Effect.asVoid,
  );
});

const assertPendingQuote = Effect.fnUntraced(function* (input: {
  readonly actual: Parameters<typeof toOrderQuoteView>[0];
  readonly pending: PendingOrderConfirmation;
}): Effect.fn.Return<void, InvalidOrderInputError> {
  const pendingQuote = toOrderQuoteView({
    items: input.pending.items,
    totalPrice: input.pending.totalPrice,
  });
  const actualQuote = toOrderQuoteView(input.actual);

  yield* Effect.succeed(Equal.equals(actualQuote, pendingQuote)).pipe(
    Effect.filterOrFail(
      (matches) => matches,
      () => invalidOrderInput("confirm the updated order before placing it"),
    ),
    Effect.asVoid,
  );
});

export const placeConfirmedOrder = Effect.fn("CoffeeOrders.placeConfirmedOrder")(function* (
  request: ConfirmedPlaceOrderRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository | OrderIdGenerator | OrderRepository | PendingOrderConfirmationRepository
> {
  const confirmation = yield* loadPendingConfirmation();
  yield* assertPendingConfirmationId(confirmation, request.confirmationId);
  yield* assertPendingSource(confirmation, "direct-order");
  const quote = yield* resolveOrderQuote(request.items);
  yield* assertPendingQuote({ actual: quote, pending: confirmation });
  const order = yield* placeOrder(request);
  const repository = yield* PendingOrderConfirmationRepository;
  yield* repository
    .clear(confirmation.ownerUserId)
    .pipe(
      Effect.mapError(
        internalAppErrorFromPersistence("Unable to clear pending order confirmation right now"),
      ),
    );
  return order;
});

export const checkoutConfirmedCart = Effect.fn("CoffeeOrders.checkoutConfirmedCart")(function* (
  request: ConfirmedCheckoutCartRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  | CartRepository
  | MenuRepository
  | OrderIdGenerator
  | OrderRepository
  | PendingOrderConfirmationRepository
> {
  const confirmation = yield* loadPendingConfirmation();
  yield* assertPendingConfirmationId(confirmation, request.confirmationId);
  yield* assertPendingSource(confirmation, "cart");
  const cartRepository = yield* CartRepository;
  const cart = yield* cartRepository.getByOwnerUserId(confirmation.ownerUserId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load cart right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(invalidOrderInput("confirm the updated order before placing it")),
        onSome: Effect.succeed,
      }),
    ),
  );
  const items = yield* decodeOrderItemsInput(cart.items.map(toOrderItemInput)).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("confirm the updated order before placing it")),
    ),
  );
  const quote = yield* resolveOrderQuote(items);
  yield* assertPendingQuote({ actual: quote, pending: confirmation });
  const order = yield* checkoutCart(request);
  const repository = yield* PendingOrderConfirmationRepository;
  yield* repository
    .clear(confirmation.ownerUserId)
    .pipe(
      Effect.mapError(
        internalAppErrorFromPersistence("Unable to clear pending order confirmation right now"),
      ),
    );
  return order;
});
