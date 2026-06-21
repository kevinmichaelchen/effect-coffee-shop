/**
 * Removes an item from the signed-in actor's cart.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { AuthenticationRequiredError } from "../CurrentActor.ts";
import type { CartItemIdRequest, CartSnapshot } from "../contracts.ts";
import { InternalAppError } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { readActorCart, saveSnapshot } from "./cartState.ts";
import { invalidOrderInput } from "./orderItems.ts";

export const removeCartItem = Effect.fn("CoffeeOrders.removeCartItem")(function* (
  input: CartItemIdRequest,
): Effect.fn.Return<
  CartSnapshot,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository
> {
  const cart = yield* readActorCart();

  yield* Effect.succeed(cart.items).pipe(
    Effect.filterOrFail(
      (items) => items.some((item) => item.id === input.cartItemId),
      () => invalidOrderInput(`cart item ${input.cartItemId} was not found`),
    ),
  );

  return yield* saveSnapshot({
    ownerUserId: cart.ownerUserId,
    items: cart.items.filter((item) => item.id !== input.cartItemId),
  });
});
