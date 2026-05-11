import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { Cart, CartItem } from "../../domain/cart.ts";
import { sumMoney } from "../../domain/money.ts";
import type { CoffeeOrder, CoffeeOrderItem } from "../../domain/order.ts";
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
import { CheckoutSessionRepository } from "../ports/CheckoutSessionRepository.ts";
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

const toOrderItemInputFromResolvedItem = (item: CoffeeOrderItem): OrderItemInput => ({
  drinkId: item.drinkId,
  size: item.size,
  milk: item.milk,
  temperature: item.temperature,
  shots: item.shots,
  quantity: item.quantity,
  ...Option.match(item.notes, {
    onNone: () => ({}),
    onSome: (notes) => ({ notes }),
  }),
});

export const checkoutCart = Effect.fn("CoffeeOrders.checkoutCart")(function* (
  input: CheckoutCartRequest,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  CartRepository | CheckoutSessionRepository | MenuRepository | OrderIdGenerator | OrderRepository
> {
  const actor = yield* requireSignedInActor();
  const checkoutSessionRepository = yield* CheckoutSessionRepository;
  const sessionOption = yield* checkoutSessionRepository
    .getById(input.checkoutSessionId)
    .pipe(
      Effect.mapError(internalAppErrorFromPersistence("Unable to load checkout session right now")),
    );
  const session = yield* sessionOption.pipe(
    Option.match({
      onNone: () =>
        Effect.fail(invalidOrderInput(`checkout session ${input.checkoutSessionId} was not found`)),
      onSome: Effect.succeed,
    }),
  );

  yield* Effect.succeed(session).pipe(
    Effect.filterOrFail(
      (checkoutSession) => checkoutSession.ownerUserId === actor.userId,
      () => invalidOrderInput(`checkout session ${input.checkoutSessionId} was not found`),
    ),
  );

  const now = yield* DateTime.now;
  yield* Effect.succeed(session).pipe(
    Effect.filterOrFail(
      (checkoutSession) =>
        DateTime.toEpochMillis(checkoutSession.expiresAt) >= DateTime.toEpochMillis(now),
      () => invalidOrderInput(`checkout session ${input.checkoutSessionId} has expired`),
    ),
  );

  const items = yield* decodeOrderItemsInput(
    session.items.map(toOrderItemInputFromResolvedItem),
  ).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("checkout session must include at least one item")),
    ),
  );
  const order = yield* placeOrder({
    items,
    ...Option.match(Option.fromUndefinedOr(input.customerName), {
      onNone: () => ({}),
      onSome: (customerName) => ({ customerName }),
    }),
  });
  const cartRepository = yield* CartRepository;
  yield* cartRepository
    .clear(actor.userId)
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to clear cart right now")));
  yield* checkoutSessionRepository
    .clearCurrentByOwnerUserId(actor.userId)
    .pipe(
      Effect.mapError(
        internalAppErrorFromPersistence("Unable to clear checkout session right now"),
      ),
    );

  return order;
});
