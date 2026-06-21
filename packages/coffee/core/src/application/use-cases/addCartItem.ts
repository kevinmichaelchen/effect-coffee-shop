/**
 * Adds an item to the signed-in actor's cart.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { AuthenticationRequiredError } from "../CurrentActor.ts";
import type { CartSnapshot, OrderItemInput } from "../contracts.ts";
import { InternalAppError } from "../errors.ts";
import { CartItemIdGenerator } from "../ports/CartItemIdGenerator.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { normalizeCartItem, readActorCart, saveSnapshot } from "./cartState.ts";

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
