/**
 * Implements actor-owned cart mutation, pricing, and checkout preparation flows.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { AuthenticationRequiredError } from "../CurrentActor.ts";
import type { CartItemIdRequest, CartSnapshot, OrderItemInput } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartItemIdGenerator } from "../ports/CartItemIdGenerator.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { normalizeCartItem, readActorCart, saveSnapshot, toSnapshot } from "./cartState.ts";
import { invalidOrderInput } from "./orderItems.ts";

export const getCart = Effect.fn("CoffeeOrders.getCart")(function* (): Effect.fn.Return<
  CartSnapshot,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository
> {
  const cart = yield* readActorCart();
  return yield* toSnapshot(cart);
});

export const addCartItem = Effect.fn("CoffeeOrders.addCartItem")(function* (
  input: OrderItemInput,
): Effect.fn.Return<
  CartSnapshot,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartItemIdGenerator | CartRepository | MenuRepository
> {
  const cart = yield* readActorCart();
  const cartItemIdGenerator = yield* CartItemIdGenerator;
  const id = yield* cartItemIdGenerator.next;
  const item = yield* normalizeCartItem(id, input);

  return yield* saveSnapshot({
    ownerUserId: cart.ownerUserId,
    items: [...cart.items, item],
  });
});

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
