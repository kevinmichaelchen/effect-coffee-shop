import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { Cart, CartItem } from "../../domain/cart.ts";
import { sumMoney } from "../../domain/money.ts";
import type { CoffeeOrder } from "../../domain/order.ts";
import { AuthenticationRequiredError, requireSignedInActor } from "../CurrentActor.ts";
import type {
  CartItemIdRequest,
  CartSnapshot,
  CheckoutCartRequest,
  OrderItemInput,
  UpdateCartItemRequest,
} from "../contracts.ts";
import { OrderItemsInputSchema } from "../contracts.ts";
import { InternalAppError, internalAppErrorFromPersistence } from "../errors.ts";
import { CartItemIdGenerator } from "../ports/CartItemIdGenerator.ts";
import { CartRepository } from "../ports/CartRepository.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { OrderIdGenerator } from "../ports/OrderIdGenerator.ts";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { invalidOrderInput, resolveOrderItem, toOrderItemInput } from "./orderItems.ts";
import { placeOrder } from "./placeOrder.ts";

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

const toSnapshot = Effect.fnUntraced(function* (
  cart: Cart,
): Effect.fn.Return<
  CartSnapshot,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  const items = yield* Effect.forEach(cart.items, (cartItem) =>
    resolveOrderItem(toOrderItemInput(cartItem)).pipe(
      Effect.map((item) => ({
        cartItemId: cartItem.id,
        item,
      })),
    ),
  );

  return {
    ownerUserId: cart.ownerUserId,
    items,
    totalPrice: sumMoney(items.map((cartItem) => cartItem.item.lineTotal)),
  };
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
    milk: resolved.milk,
    temperature: resolved.temperature,
    shots: resolved.shots,
    quantity: resolved.quantity,
    ...(resolved.notes === undefined ? {} : { notes: resolved.notes }),
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
  const milk = input.milk ?? currentItem.milk;
  const temperature = input.temperature ?? currentItem.temperature;
  const shots = input.shots ?? currentItem.shots;
  const notes = input.notes ?? currentItem.notes;
  const item = yield* normalizeCartItem(
    input.cartItemId,
    toOrderItemInput({
      drinkId: input.drinkId ?? currentItem.drinkId,
      size: input.size ?? currentItem.size,
      quantity: input.quantity ?? currentItem.quantity,
      ...(milk === undefined ? {} : { milk }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(shots === undefined ? {} : { shots }),
      ...(notes === undefined ? {} : { notes }),
    }),
  );

  return yield* saveSnapshot({
    ownerUserId: cart.ownerUserId,
    items: cart.items.map((cartItem) => (cartItem.id === input.cartItemId ? item : cartItem)),
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

  if (!cart.items.some((item) => item.id === input.cartItemId)) {
    return yield* invalidOrderInput(`cart item ${input.cartItemId} was not found`);
  }

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

export const checkoutCart = Effect.fn("CoffeeOrders.checkoutCart")(function* (
  input: CheckoutCartRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | MenuRepository | OrderIdGenerator | OrderRepository
> {
  const cart = yield* readActorCart();

  if (cart.items.length === 0) {
    return yield* invalidOrderInput("cart must include at least one item");
  }

  const items = yield* decodeOrderItemsInput(cart.items.map(toOrderItemInput)).pipe(
    Effect.mapError(() => invalidOrderInput("cart must include at least one item")),
  );
  const order = yield* placeOrder({
    items,
    ...(input.customerName === undefined ? {} : { customerName: input.customerName }),
  });
  const cartRepository = yield* CartRepository;
  yield* cartRepository
    .clear(cart.ownerUserId)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to clear cart right now")));

  return order;
});
