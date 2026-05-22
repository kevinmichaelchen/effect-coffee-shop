/**
 * Reads and expires checkout sessions awaiting actor confirmation.
 *
 * @module
 */
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { Cart } from "../../domain/cart.ts";
import type { CheckoutSession } from "../../domain/checkout-session.ts";
import { AuthenticationRequiredError, requireSignedInActor } from "../CurrentActor.ts";
import { OrderItemsInputSchema } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { CheckoutSessionIdGenerator } from "../ports/CheckoutSessionIdGenerator.ts";
import { CheckoutSessionRepository } from "../ports/CheckoutSessionRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { invalidOrderInput, resolveOrderQuote, toOrderItemInput } from "./orderItems.ts";

const checkoutSessionTtlMinutes = 15;
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

export const prepareCartCheckout = Effect.fn("CoffeeOrders.prepareCartCheckout")(
  function* (): Effect.fn.Return<
    CheckoutSession,
    AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
    CartRepository | CheckoutSessionIdGenerator | CheckoutSessionRepository | MenuRepository
  > {
    const cart = yield* readActorCart();
    const items = yield* decodeOrderItemsInput(cart.items.map(toOrderItemInput)).pipe(
      Effect.catchTag("SchemaError", () =>
        Effect.fail(invalidOrderInput("cart must include at least one item")),
      ),
    );
    const quote = yield* resolveOrderQuote(items);
    const checkoutSessionIdGenerator = yield* CheckoutSessionIdGenerator;
    const checkoutSessionRepository = yield* CheckoutSessionRepository;
    const id = yield* checkoutSessionIdGenerator.next;
    const now = yield* DateTime.now;
    const expiresAt = DateTime.add(now, { minutes: checkoutSessionTtlMinutes });

    return yield* checkoutSessionRepository
      .save({
        id,
        ownerUserId: cart.ownerUserId,
        status: "awaiting_confirmation",
        items: quote.items,
        totalPrice: quote.totalPrice,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .pipe(
        Effect.mapError(
          internalAppErrorFromPersistence("Unable to save checkout session right now"),
        ),
      );
  },
);

export const getCurrentCheckoutSession = Effect.fn("CoffeeOrders.getCurrentCheckoutSession")(
  function* (): Effect.fn.Return<
    Option.Option<CheckoutSession>,
    AuthenticationRequiredError | InternalAppError,
    CheckoutSessionRepository
  > {
    const actor = yield* requireSignedInActor();
    const checkoutSessionRepository = yield* CheckoutSessionRepository;
    return yield* checkoutSessionRepository
      .getCurrentByOwnerUserId(actor.userId)
      .pipe(
        Effect.mapError(
          internalAppErrorFromPersistence("Unable to load checkout session right now"),
        ),
      );
  },
);
