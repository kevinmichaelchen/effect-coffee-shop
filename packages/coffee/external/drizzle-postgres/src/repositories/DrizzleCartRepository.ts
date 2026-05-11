import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { asc, eq } from "drizzle-orm";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzleCartItemRowSchema, toCartItem, toCartItemInsert } from "../db/models.ts";
import { cartItemsTable, cartsTable } from "../db/schema.ts";

const decodeCartItemRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleCartItemRowSchema));

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

export const DrizzleCartRepositoryLive = Layer.effect(
  CartRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    const loadCart = (ownerUserId: string) =>
      db
        .select()
        .from(cartItemsTable)
        .where(eq(cartItemsTable.ownerUserId, ownerUserId))
        .orderBy(asc(cartItemsTable.position))
        .pipe(
          Effect.flatMap(decodeCartItemRows),
          Effect.map((items): Cart => ({ ownerUserId, items: items.map(toCartItem) })),
        );

    const save = Effect.fn("DrizzleCartRepository.save")(function* (cart: Cart) {
      yield* db.insert(cartsTable).values({ ownerUserId: cart.ownerUserId }).onConflictDoNothing();
      yield* db.delete(cartItemsTable).where(eq(cartItemsTable.ownerUserId, cart.ownerUserId));
      yield* Effect.forEach(
        cart.items.map((item, position) => toCartItemInsert(cart.ownerUserId, item, position)),
        (item) => db.insert(cartItemsTable).values(item),
        { discard: true },
      );
      return cart;
    });

    const clear = Effect.fn("DrizzleCartRepository.clear")(function* (ownerUserId: string) {
      yield* db.delete(cartItemsTable).where(eq(cartItemsTable.ownerUserId, ownerUserId));
      yield* db.delete(cartsTable).where(eq(cartsTable.ownerUserId, ownerUserId));
      return emptyCart(ownerUserId);
    });

    const getByOwnerUserId = Effect.fn("DrizzleCartRepository.getByOwnerUserId")(function* (
      ownerUserId: string,
    ) {
      const cart = yield* loadCart(ownerUserId);
      return cart.items.length === 0 ? Option.none<Cart>() : Option.some(cart);
    });

    return CartRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        getByOwnerUserId(ownerUserId).pipe(
          PersistenceError.refail(`Failed to load cart "${ownerUserId}"`),
        ),
      save: (cart) =>
        save(cart).pipe(PersistenceError.refail(`Failed to save cart "${cart.ownerUserId}"`)),
      clear: (ownerUserId) =>
        clear(ownerUserId).pipe(PersistenceError.refail(`Failed to clear cart "${ownerUserId}"`)),
    });
  }),
);
