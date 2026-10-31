import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Domain from "@alchemy.run/domain";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CurrentActor } from "../CurrentActor.context.ts";
import { CustomerId } from "../Customer/Customer.id.ts";
import { customerNameFor } from "../customerName.ts";
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
import { Session } from "../Session.middleware.ts";
import { AddCartItem, CartItemAdded } from "./AddCartItem.command.ts";
import { CartItemNotFound } from "./CartItemNotFound.rejection.ts";
import type { CartItemId } from "./CartItem.id.ts";
import { CartLine, type CartSnapshot } from "./CartSnapshot.ts";
import { Checkout, type CheckoutId, checkoutLifetime } from "./Checkout.ts";
import { CartCleared, ClearCart } from "./ClearCart.command.ts";
import {
  CheckoutConfirmed,
  CheckoutExpired,
  CheckoutNotFound,
  ConfirmCheckout,
} from "./ConfirmCheckout.command.ts";
import { NotYourCart } from "./NotYourCart.rejection.ts";
import { CheckoutPrepared, PrepareCheckout } from "./PrepareCheckout.command.ts";
import { CartItemRemoved, RemoveCartItem } from "./RemoveCartItem.command.ts";
import { CartItemUpdated, UpdateCartItem } from "./UpdateCartItem.command.ts";

const CartState = Schema.Struct({
  lines: Schema.Array(CartLine),
  checkout: Schema.NullOr(Checkout),
});
export type CartState = typeof CartState.Type;

/** Each person changes only their own cart: a cart is keyed by its owner. */
const mustOwn = (owner: CustomerId) =>
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

/** The checkout awaiting confirmation, if it is the one asked for. */
const awaitingCheckout = (state: CartState, checkoutId: CheckoutId): Option.Option<Checkout> =>
  Option.filter(
    Option.fromNullishOr(state.checkout),
    (checkout) => checkout.checkoutId === checkoutId,
  );

const replace = (state: CartState, line: CartLine): CartState => ({
  ...state,
  lines: Arr.map(state.lines, (existing) =>
    existing.cartItemId === line.cartItemId ? line : existing,
  ),
});

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

// The reply follows an accepted ConfirmCheckout, which records exactly one confirmation.
const confirmedOrder = (_state: CartState, events: ReadonlyArray<object>) => ({
  orderId: Option.match(Arr.findFirst(events, Schema.is(CheckoutConfirmed)), {
    onNone: () => invariantViolated("A confirmation reply requires its event"),
    onSome: (confirmed) => confirmed.orderId,
  }),
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
  commands: [
    AddCartItem,
    UpdateCartItem,
    RemoveCartItem,
    ClearCart,
    PrepareCheckout,
    ConfirmCheckout,
  ],
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
    ConfirmCheckout: Effect.fn(function* (state, command, { id, now }) {
      yield* mustOwn(id);
      const checkout = yield* Effect.fromOption(awaitingCheckout(state, command.checkoutId)).pipe(
        Effect.mapError(() => new CheckoutNotFound({ checkoutId: command.checkoutId })),
      );
      if (DateTime.isGreaterThan(now, checkout.expiresAt)) {
        return yield* new CheckoutExpired({
          checkoutId: checkout.checkoutId,
          expiredAt: checkout.expiresAt,
        });
      }
      const customerName = yield* customerNameFor(
        yield* CurrentActor,
        Option.fromUndefinedOr(command.customerName),
      );
      return [new CheckoutConfirmed({ orderId: command.orderId, customerName, checkout })];
    }),
  },
  evolve: {
    CartItemAdded: (state, event) => ({
      ...state,
      lines: [...state.lines, { cartItemId: event.cartItemId, item: event.item }],
    }),
    CartItemUpdated: (state, event) =>
      replace(state, { cartItemId: event.cartItemId, item: event.item }),
    CartItemRemoved: (state, event) => ({
      ...state,
      lines: Arr.filter(state.lines, (line) => line.cartItemId !== event.cartItemId),
    }),
    CartCleared: () => ({ lines: [], checkout: null }),
    CheckoutPrepared: (state, event) => ({ ...state, checkout: event.checkout }),
    CheckoutConfirmed: () => ({ lines: [], checkout: null }),
  },
  reply: {
    AddCartItem: cartReply,
    UpdateCartItem: cartReply,
    RemoveCartItem: cartReply,
    ClearCart: cartReply,
    PrepareCheckout: preparedCheckout,
    ConfirmCheckout: confirmedOrder,
  },
  // Owners may read and watch their own cart through an Api.
  read: {
    middleware: [Session],
    rejects: [NotYourCart],
    validate: Effect.fn(function* (request) {
      yield* mustOwn(request.key.id);
    }),
  },
}) {}
