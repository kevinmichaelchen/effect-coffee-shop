import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Random from "effect/Random";
import * as Schema from "effect/Schema";
import type {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import {
  pendingOrderConfirmationStatus,
  pendingOrderConfirmationIdFromString,
  type PendingOrderConfirmation,
} from "@effect-coffee-shop/coffee-core/domain/pending-order-confirmation";
import {
  AuthenticationRequiredError,
  requireSignedInActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import type { Cart } from "../../domain/cart.ts";
import { OrderItemsInputSchema, type QuoteOrderRequest } from "../contracts.ts";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { PendingOrderConfirmationRepository } from "../ports/PendingOrderConfirmationRepository.ts";
import { invalidOrderInput, resolveOrderQuote, toOrderItemInput } from "./orderItems.ts";

const decodeOrderItemsInput = Schema.decodeUnknownEffect(OrderItemsInputSchema);

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

const readActorCart = Effect.fnUntraced(function* (): Effect.fn.Return<
  Cart,
  AuthenticationRequiredError | InternalAppError,
  CartRepository
> {
  const actor = yield* requireSignedInActor();
  const cartRepository = yield* CartRepository;
  return yield* cartRepository.getByOwnerUserId(actor.userId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load cart right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.succeed(emptyCart(actor.userId)),
        onSome: Effect.succeed,
      }),
    ),
  );
});

const savePendingConfirmation = Effect.fnUntraced(function* (input: {
  readonly confirmation: PendingOrderConfirmation;
}): Effect.fn.Return<
  PendingOrderConfirmation,
  InternalAppError,
  PendingOrderConfirmationRepository
> {
  const repository = yield* PendingOrderConfirmationRepository;
  return yield* repository
    .save(input.confirmation)
    .pipe(
      Effect.mapError(
        internalAppErrorFromPersistence("Unable to save pending order confirmation right now"),
      ),
    );
});

export const prepareOrderConfirmation = Effect.fn("CoffeeOrders.prepareOrderConfirmation")(
  function* (
    request: QuoteOrderRequest,
  ): Effect.fn.Return<
    PendingOrderConfirmation,
    AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
    MenuRepository | PendingOrderConfirmationRepository
  > {
    const actor = yield* requireSignedInActor();
    const quote = yield* resolveOrderQuote(request.items);
    const updatedAt = yield* DateTime.now;
    const confirmationId = yield* Random.nextUUIDv4.pipe(
      Effect.map(pendingOrderConfirmationIdFromString),
    );

    return yield* savePendingConfirmation({
      confirmation: {
        confirmationId,
        ownerUserId: actor.userId,
        source: "direct-order",
        status: pendingOrderConfirmationStatus,
        items: quote.items,
        totalPrice: quote.totalPrice,
        updatedAt,
      },
    });
  },
);

export const prepareCartConfirmation = Effect.fn("CoffeeOrders.prepareCartConfirmation")(
  function* (): Effect.fn.Return<
    PendingOrderConfirmation,
    AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
    CartRepository | MenuRepository | PendingOrderConfirmationRepository
  > {
    const cart = yield* readActorCart();
    const items = yield* decodeOrderItemsInput(cart.items.map(toOrderItemInput)).pipe(
      Effect.catchTag("SchemaError", () =>
        Effect.fail(invalidOrderInput("cart must include at least one item")),
      ),
    );
    const quote = yield* resolveOrderQuote(items);
    const updatedAt = yield* DateTime.now;
    const confirmationId = yield* Random.nextUUIDv4.pipe(
      Effect.map(pendingOrderConfirmationIdFromString),
    );

    return yield* savePendingConfirmation({
      confirmation: {
        confirmationId,
        ownerUserId: cart.ownerUserId,
        source: "cart",
        status: pendingOrderConfirmationStatus,
        items: quote.items,
        totalPrice: quote.totalPrice,
        updatedAt,
      },
    });
  },
);

export const getPendingOrderConfirmation = Effect.fn("CoffeeOrders.getPendingOrderConfirmation")(
  function* (): Effect.fn.Return<
    Option.Option<PendingOrderConfirmation>,
    AuthenticationRequiredError | InternalAppError,
    PendingOrderConfirmationRepository
  > {
    const actor = yield* requireSignedInActor();
    const repository = yield* PendingOrderConfirmationRepository;
    return yield* repository
      .getByOwnerUserId(actor.userId)
      .pipe(
        Effect.mapError(
          internalAppErrorFromPersistence("Unable to load pending order confirmation right now"),
        ),
      );
  },
);
