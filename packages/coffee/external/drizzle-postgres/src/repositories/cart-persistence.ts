/**
 * Loads and saves cart rows with Drizzle/Postgres.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { asc, eq } from "drizzle-orm";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CoffeeDb } from "../db/Db.ts";
import { DrizzleCartItemRowSchema, toCartItem, toCartItemInsert } from "../db/models.ts";
import { cartItemsTable, cartsTable } from "../db/schema.ts";

type Db = CoffeeDb["Service"];

const decodeCartItemRows = Schema.decodeUnknownEffect(Schema.Array(DrizzleCartItemRowSchema));

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

const loadedCartOption = (cart: Cart) =>
  cart.items.length === 0 ? Option.none<Cart>() : Option.some(cart);

const loadCart = (db: Db, ownerUserId: string) =>
  db
    .select()
    .from(cartItemsTable)
    .where(eq(cartItemsTable.ownerUserId, ownerUserId))
    .orderBy(asc(cartItemsTable.position))
    .pipe(
      Effect.flatMap(decodeCartItemRows),
      Effect.map((items): Cart => ({ ownerUserId, items: items.map(toCartItem) })),
    );

export const loadCartByOwnerUserId = (db: Db, ownerUserId: string) =>
  loadCart(db, ownerUserId).pipe(Effect.map(loadedCartOption));

export const saveCart = (db: Db, cart: Cart) =>
  Effect.gen(function* () {
    yield* db.insert(cartsTable).values({ ownerUserId: cart.ownerUserId }).onConflictDoNothing();
    yield* db.delete(cartItemsTable).where(eq(cartItemsTable.ownerUserId, cart.ownerUserId));
    yield* Effect.forEach(
      cart.items.map((item, position) => toCartItemInsert(cart.ownerUserId, item, position)),
      (item) => db.insert(cartItemsTable).values(item),
      { concurrency: 1, discard: true },
    );
    return cart;
  });

export const clearCart = (db: Db, ownerUserId: string) =>
  Effect.gen(function* () {
    yield* db.delete(cartItemsTable).where(eq(cartItemsTable.ownerUserId, ownerUserId));
    yield* db.delete(cartsTable).where(eq(cartsTable.ownerUserId, ownerUserId));
    return emptyCart(ownerUserId);
  });
