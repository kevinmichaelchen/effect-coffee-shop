/**
 * Stores actor carts in memory for local and test runtimes.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";

type CartOwnerUserId = Cart["ownerUserId"];

const emptyCart = (ownerUserId: CartOwnerUserId): Cart => ({
  ownerUserId,
  items: [],
});

export const InMemoryCartRepositoryLive = Layer.effect(
  CartRepository,
  Effect.gen(function* () {
    const carts = yield* Ref.make(HashMap.empty<CartOwnerUserId, Cart>());

    return CartRepository.of({
      getByOwnerUserId: (ownerUserId) => Ref.get(carts).pipe(Effect.map(HashMap.get(ownerUserId))),
      save: (cart) => Ref.update(carts, HashMap.set(cart.ownerUserId, cart)).pipe(Effect.as(cart)),
      clear: (ownerUserId) =>
        Ref.update(carts, HashMap.remove(ownerUserId)).pipe(Effect.as(emptyCart(ownerUserId))),
    });
  }),
);
