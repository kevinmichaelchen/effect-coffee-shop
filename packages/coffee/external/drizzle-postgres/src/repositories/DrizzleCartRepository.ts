/**
 * Persists actor carts with Drizzle/Postgres.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { CoffeeDb } from "../db/Db.ts";
import { clearCart, loadCartByOwnerUserId, saveCart } from "./cart-persistence.ts";

export const DrizzleCartRepositoryLive = Layer.effect(
  CartRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    return CartRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        loadCartByOwnerUserId(db, ownerUserId).pipe(
          PersistenceError.refail(`Failed to load cart "${ownerUserId}"`),
        ),
      save: (cart) =>
        saveCart(db, cart).pipe(
          PersistenceError.refail(`Failed to save cart "${cart.ownerUserId}"`),
        ),
      clear: (ownerUserId) =>
        clearCart(db, ownerUserId).pipe(
          PersistenceError.refail(`Failed to clear cart "${ownerUserId}"`),
        ),
    });
  }),
);
