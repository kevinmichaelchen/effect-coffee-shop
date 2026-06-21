/**
 * Implements actor-owned cart mutation, pricing, and checkout preparation flows.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { Cart, CartItem } from "../../domain/cart.ts";
import { sumMoney } from "../../domain/money.ts";
import { AuthenticationRequiredError, requireSignedInActor } from "../CurrentActor.ts";
import type {
  CartItemIdRequest,
  CartSnapshot,
  OrderItemInput,
  UpdateCartItemRequest,
} from "../contracts.ts";
import { CartItemQuoteSchema } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartItemIdGenerator } from "../ports/CartItemIdGenerator.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import {
  invalidOrderInput,
  resolveOrderItem,
  resolveOrderItems,
  toOrderItemInput,
} from "./orderItems.ts";

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

const toSnapshot = Effect.fnUntraced(function* (
  cart: Cart,
): Effect.fn.Return<
  CartSnapshot,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  const resolvedItems = yield* resolveOrderItems(cart.items.map(toOrderItemInput));
  const items = cart.items.map((cartItem, index) => ({
    cartItemId: cartItem.id,
    item: resolvedItems[index],
  }));

  return yield* Schema.decodeUnknownEffect(Schema.Array(Schema.toType(CartItemQuoteSchema)))(
    items,
  ).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("cart items could not be resolved")),
    ),
    Effect.map((decodedItems) => ({
      ownerUserId: cart.ownerUserId,
      items: decodedItems,
      totalPrice: sumMoney(decodedItems.map((cartItem) => cartItem.item.lineTotal)),
    })),
  );
});

const normalizeCartItem = Effect.fnUntraced(function* (
  id: CartItem["id"],
  input: OrderItemInput,
): Effect.fn.Return<
  CartItem,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  const resolved = yield* resolveOrderItem(input);

  return {
    id,
    drinkId: resolved.drinkId,
    size: resolved.size,
    milk: Option.some(resolved.milk),
    temperature: Option.some(resolved.temperature),
    shots: Option.some(resolved.shots),
    notes: resolved.notes,
    quantity: resolved.quantity,
  };
});

const saveSnapshot = Effect.fnUntraced(function* (
  cart: Cart,
): Effect.fn.Return<
  CartSnapshot,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository
> {
  const cartRepository = yield* CartRepository;
  const saved = yield* cartRepository
    .save(cart)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to save cart right now")));
  return yield* toSnapshot(saved);
});

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
