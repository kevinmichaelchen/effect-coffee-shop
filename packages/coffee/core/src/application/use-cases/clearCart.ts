/**
 * Clears the signed-in actor's cart.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { AuthenticationRequiredError } from "../CurrentActor.ts";
import type { CartSnapshot } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { readActorCart, toSnapshot } from "./cartState.ts";

export const clearCart = Effect.fn("CoffeeOrders.clearCart")(function* (): Effect.fn.Return<
  CartSnapshot,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository
> {
  const cart = yield* readActorCart();
  const cartRepository = yield* CartRepository;
  const cleared = yield* cartRepository
    .clear(cart.ownerUserId)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to clear cart right now")));
  return yield* toSnapshot(cleared);
});
