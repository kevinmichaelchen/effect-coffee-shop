/**
 * Finalizes a confirmed cart checkout session into an order.
 *
 * @module
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { CheckoutSession } from "../../domain/checkout-session.ts";
import type { CoffeeOrder, CoffeeOrderItem } from "../../domain/order.ts";
import { AuthenticationRequiredError, requireSignedInActor } from "../CurrentActor.ts";
import type { CheckoutCartRequest, OrderItemInput } from "../contracts.ts";
import { OrderItemsInputSchema } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { CheckoutSessionRepository } from "../ports/CheckoutSessionRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { invalidOrderInput } from "./orderItems.ts";
import { placeOrder } from "./placeOrder.ts";

const decodeOrderItemsInput = Schema.decodeUnknownEffect(OrderItemsInputSchema);

const toOrderItemInputFromResolvedItem = (item: CoffeeOrderItem): OrderItemInput => ({
  drinkId: item.drinkId,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  ...Option.match(item.notes, {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

const requireCheckoutSession = (
  input: CheckoutCartRequest,
): Effect.Effect<
  CheckoutSession,
  InvalidOrderInputError | InternalAppError,
  CheckoutSessionRepository
> =>
  CheckoutSessionRepository.pipe(
    Effect.flatMap((checkoutSessionRepository) =>
      checkoutSessionRepository
        .getById(input.checkoutSessionId)
        .pipe(
          Effect.mapError(
            internalAppErrorFromPersistence("Unable to load checkout session right now"),
          ),
        ),
    ),
    Effect.flatMap(
      Option.match({
        onNone: () =>
          Effect.fail(
            invalidOrderInput(`checkout session ${input.checkoutSessionId} was not found`),
          ),
        onSome: Effect.succeed,
      }),
    ),
  );

const requireOwnedCheckoutSession = (
  session: CheckoutSession,
  input: CheckoutCartRequest,
  ownerUserId: string,
): Effect.Effect<CheckoutSession, InvalidOrderInputError> =>
  Effect.succeed(session).pipe(
    Effect.filterOrFail(
      (checkoutSession) => checkoutSession.ownerUserId === ownerUserId,
      () => invalidOrderInput(`checkout session ${input.checkoutSessionId} was not found`),
    ),
  );

const requireUnexpiredCheckoutSession = (
  session: CheckoutSession,
  input: CheckoutCartRequest,
): Effect.Effect<CheckoutSession, InvalidOrderInputError> =>
  DateTime.now.pipe(
    Effect.flatMap((now) =>
      Effect.succeed(session).pipe(
        Effect.filterOrFail(
          (checkoutSession) =>
            DateTime.toEpochMillis(checkoutSession.expiresAt) >= DateTime.toEpochMillis(now),
          () => invalidOrderInput(`checkout session ${input.checkoutSessionId} has expired`),
        ),
      ),
    ),
  );

const decodeCheckoutItems = (session: CheckoutSession) =>
  decodeOrderItemsInput(session.items.map(toOrderItemInputFromResolvedItem)).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("checkout session must include at least one item")),
    ),
  );

export const checkoutCart = Effect.fn("CoffeeOrders.checkoutCart")(function* (
  input: CheckoutCartRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | CheckoutSessionRepository | MenuRepository | OrderIdGenerator | OrderRepository
> {
  const actor = yield* requireSignedInActor();
  const session = yield* requireCheckoutSession(input);
  yield* requireOwnedCheckoutSession(session, input, actor.userId);
  yield* requireUnexpiredCheckoutSession(session, input);
  const items = yield* decodeCheckoutItems(session);
  const order = yield* placeOrder({
    items,
    ...Option.match(Option.fromUndefinedOr(input.customerName), {
      onNone: () => ({}),
      onSome: (customerName) => ({ customerName }),
    }),
  });
  const cartRepository = yield* CartRepository;
  const checkoutSessionRepository = yield* CheckoutSessionRepository;
  yield* cartRepository
    .clear(actor.userId)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to clear cart right now")));
  yield* checkoutSessionRepository
    .clearCurrentByOwnerUserId(actor.userId)
    .pipe(
      Effect.mapError(
        internalAppErrorFromPersistence("Unable to clear checkout session right now"),
      ),
    );

  return order;
});
