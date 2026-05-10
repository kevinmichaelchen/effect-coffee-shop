import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

export const InMemoryCartRepositoryLive = Layer.effect(
  CartRepository,
  Effect.sync(() => {
    const carts = new Map<string, Cart>();

    return CartRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        Effect.succeed(Option.fromUndefinedOr(carts.get(ownerUserId))),
      save: (cart) =>
        Effect.sync(() => {
          carts.set(cart.ownerUserId, cart);
          return cart;
        }),
      clear: (ownerUserId) =>
        Effect.sync(() => {
          const cart = emptyCart(ownerUserId);
          carts.delete(ownerUserId);
          return cart;
        }),
    });
  }),
);
