/**
 * Updates an item in the signed-in actor's cart.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { AuthenticationRequiredError } from "../CurrentActor.ts";
import type { CartSnapshot, UpdateCartItemRequest } from "../contracts.ts";
import { InternalAppError } from "../errors.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { normalizeCartItem, readActorCart, saveSnapshot } from "./cartState.ts";
import { invalidOrderInput, toOrderItemInput } from "./orderItems.ts";

export const updateCartItem = Effect.fn("CoffeeOrders.updateCartItem")(function* (
  input: UpdateCartItemRequest,
): Effect.fn.Return<
  CartSnapshot,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository
> {
  const cart = yield* readActorCart();
  const currentItem = yield* Option.fromUndefinedOr(
    cart.items.find((item) => item.id === input.cartItemId),
  ).pipe(
    Option.match({
      onNone: () => Effect.fail(invalidOrderInput(`cart item ${input.cartItemId} was not found`)),
      onSome: Effect.succeed,
    }),
  );
  const milk = Option.fromUndefinedOr(input.milk).pipe(Option.orElse(() => currentItem.milk));
  const temperature = Option.fromUndefinedOr(input.temperature).pipe(
    Option.orElse(() => currentItem.temperature),
  );
  const shots = Option.fromUndefinedOr(input.shots).pipe(Option.orElse(() => currentItem.shots));
  const notes = Option.fromUndefinedOr(input.notes).pipe(Option.orElse(() => currentItem.notes));
  const item = yield* normalizeCartItem(
    input.cartItemId,
    toOrderItemInput({
      drinkId: input.drinkId ?? currentItem.drinkId,
      size: input.size ?? currentItem.size,
      quantity: input.quantity ?? currentItem.quantity,
      milk,
      temperature,
      shots,
      notes,
    }),
  );

  return yield* saveSnapshot({
    ownerUserId: cart.ownerUserId,
    items: Arr.map(cart.items, (cartItem) =>
      Match.value(cartItem.id === input.cartItemId).pipe(
        Match.when(true, () => item),
        Match.orElse(() => cartItem),
      ),
    ),
  });
});
