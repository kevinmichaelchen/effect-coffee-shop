/**
 * Shared cart loading, normalization, and snapshot helpers.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { Cart, CartItem } from "../../domain/cart.ts";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import { sumMoney } from "../../domain/money.ts";
import { AuthenticationRequiredError, requireSignedInActor } from "../CurrentActor.ts";
import type { CartSnapshot, OrderItemInput } from "../contracts.ts";
import { CartItemQuoteSchema } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
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

export const readActorCart = Effect.fnUntraced(function* (): Effect.fn.Return<
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

export const toSnapshot = Effect.fnUntraced(function* (
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

export const normalizeCartItem = Effect.fnUntraced(function* (
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

export const saveSnapshot = Effect.fnUntraced(function* (
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
