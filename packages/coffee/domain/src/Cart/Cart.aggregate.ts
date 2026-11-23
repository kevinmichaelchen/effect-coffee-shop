import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { CurrentActor } from "../CurrentActor.context.ts";
import { CustomerId } from "../Customer/Customer.id.ts";
import { invariantViolated } from "../Invariant.ts";
import { InvalidOrder } from "../Menu/InvalidOrder.rejection.ts";
import {
  type DrinkSelectionChanges,
  type DrinkSelection,
  priceOrderItem,
  quoteOrder,
  toDrinkSelection,
  totalOf,
} from "../Menu/OrderItem.ts";
import { AddCartItem, CartItemAdded } from "./AddCartItem.command.ts";
import { CartItemNotFound } from "./CartItemNotFound.rejection.ts";
import type { CartItemId } from "./CartItem.id.ts";
import { CartLine, type CartSnapshot } from "./CartSnapshot.ts";
import { Checkout, checkoutLifetime } from "./Checkout.ts";
import { CartCleared, ClearCart } from "./ClearCart.command.ts";
import { CheckoutConfirmed } from "./ConfirmCheckout.command.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";
import { CheckoutPrepared, PrepareCheckout } from "./PrepareCheckout.command.ts";
import { CartItemRemoved, RemoveCartItem } from "./RemoveCartItem.command.ts";
import { CartItemUpdated, UpdateCartItem } from "./UpdateCartItem.command.ts";

export const CartState = Schema.Struct({
  lines: Schema.Array(CartLine),
  checkout: Schema.NullOr(Checkout),
});
export type CartState = typeof CartState.Type;

/** Each person changes only their own cart: a cart is keyed by its owner. */
export const mustOwn = (owner: CustomerId) =>
  CurrentActor.pipe(
    Effect.filterOrFail(
      (actor) => actor.userId === owner,
      () => new NotYourCart(),
    ),
    Effect.asVoid,
  );

const lineOf = (state: CartState, cartItemId: CartItemId) =>
  Effect.fromOption(Arr.findFirst(state.lines, (line) => line.cartItemId === cartItemId)).pipe(
    Effect.mapError(() => new CartItemNotFound({ cartItemId })),
  );

/** A line's choices with some of them changed. */
const withChanges = (line: CartLine, changes: DrinkSelectionChanges): DrinkSelection => ({
  ...toDrinkSelection(line.item),
  ...changes,
});

const replace = (state: CartState, line: CartLine): CartState => ({
  ...state,
  lines: Arr.map(state.lines, (existing) =>
    existing.cartItemId === line.cartItemId ? line : existing,
  ),
});

/** How each cart event changes a cart: the aggregate's state and its owner's view of it. */
export const cartEvolve = {
  CartItemAdded: (state: CartState, event: CartItemAdded): CartState => ({
    ...state,
    lines: [...state.lines, { cartItemId: event.cartItemId, item: event.item }],
  }),
  CartItemUpdated: (state: CartState, event: CartItemUpdated): CartState =>
    replace(state, { cartItemId: event.cartItemId, item: event.item }),
  CartItemRemoved: (state: CartState, event: CartItemRemoved): CartState => ({
    ...state,
    lines: Arr.filter(state.lines, (line) => line.cartItemId !== event.cartItemId),
  }),
  CartCleared: (): CartState => ({ lines: [], checkout: null }),
  CheckoutPrepared: (state: CartState, event: CheckoutPrepared): CartState => ({
    ...state,
    checkout: event.checkout,
  }),
  CheckoutConfirmed: (): CartState => ({ lines: [], checkout: null }),
};

export const snapshotOf = (state: CartState): CartSnapshot => ({
  items: state.lines,
  totalPrice: totalOf(Arr.map(state.lines, (line) => line.item)),
  checkout: state.checkout,
});

const cartReply = (state: CartState) => ({ cart: snapshotOf(state) });

// The reply follows an accepted PrepareCheckout, so the checkout exists.
const preparedCheckout = (state: CartState) => ({
  checkout: state.checkout ?? invariantViolated("A checkout reply requires a prepared checkout"),
});

/**
 * One person's cart, keyed by who owns it: the drinks they are collecting,
 * and the checkout they have been asked to confirm. Emptying the cart and
 * confirming the checkout happen in one step, so a confirmed cart can never
 * be ordered twice.
 */
export class Cart extends Domain.Aggregate("Cart", {
  id: CustomerId,
  state: CartState,
  initial: { lines: [], checkout: null },
  commands: [AddCartItem, UpdateCartItem, RemoveCartItem, ClearCart, PrepareCheckout],
  keyOf: (command) => command.customerId,
  events: [CheckoutConfirmed],
  decide: {
    AddCartItem: Effect.fn(function* (state, command, { id }) {
      yield* mustOwn(id);
      if (state.lines.some((line) => line.cartItemId === command.cartItemId)) return [];
      const item = yield* Effect.fromResult(priceOrderItem(command.item));
      return [new CartItemAdded({ cartItemId: command.cartItemId, item })];
    }),
    UpdateCartItem: Effect.fn(function* (state, command, { id }) {
      yield* mustOwn(id);
      const line = yield* lineOf(state, command.cartItemId);
      const item = yield* Effect.fromResult(priceOrderItem(withChanges(line, command.changes)));
      return [new CartItemUpdated({ cartItemId: command.cartItemId, item })];
    }),
    RemoveCartItem: Effect.fn(function* (state, command, { id }) {
      yield* mustOwn(id);
      yield* lineOf(state, command.cartItemId);
      return [new CartItemRemoved({ cartItemId: command.cartItemId })];
    }),
    ClearCart: Effect.fn(function* (state, _command, { id }) {
      yield* mustOwn(id);
      return Arr.isReadonlyArrayEmpty(state.lines) && state.checkout === null
        ? []
        : [new CartCleared()];
    }),
    PrepareCheckout: Effect.fn(function* (state, command, { id, now }) {
      yield* mustOwn(id);
      if (Arr.isReadonlyArrayEmpty(state.lines)) {
        return yield* new InvalidOrder({ message: "cart must include at least one item" });
      }
      // Re-price every line now: the checkout holds today's prices, not the ones seen when adding.
      const quote = yield* Effect.fromResult(
        quoteOrder(Arr.map(state.lines, (line) => toDrinkSelection(line.item))),
      );
      return [
        new CheckoutPrepared({
          checkout: {
            checkoutId: command.checkoutId,
            items: quote.items,
            totalPrice: quote.totalPrice,
            createdAt: now,
            expiresAt: DateTime.add(now, checkoutLifetime),
          },
        }),
      ];
    }),
  },
  evolve: cartEvolve,
  reply: {
    AddCartItem: cartReply,
    UpdateCartItem: cartReply,
    RemoveCartItem: cartReply,
    ClearCart: cartReply,
    PrepareCheckout: preparedCheckout,
  },
}) {}
