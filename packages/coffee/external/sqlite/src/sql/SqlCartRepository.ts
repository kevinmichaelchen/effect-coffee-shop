import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { SqlCartItemModel, toCartItem, toSqlCartItemSave } from "./models.ts";
import { deleteCartByOwner } from "./queries/.generated/delete-cart-by-owner.sql.ts";
import { deleteCartItemsByOwner } from "./queries/.generated/delete-cart-items-by-owner.sql.ts";
import { insertCart } from "./queries/.generated/insert-cart.sql.ts";
import { listCartItems } from "./queries/.generated/list-cart-items.sql.ts";
import { saveCartItem } from "./queries/.generated/save-cart-item.sql.ts";

const decodeSqlCartItems = Schema.decodeUnknownEffect(Schema.Array(SqlCartItemModel));

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

const makeSqlCartQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlCartRepository.save")(function* (cart: Cart) {
    yield* insertCart({ ownerUserId: cart.ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* deleteCartItemsByOwner({ ownerUserId: cart.ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* Effect.forEach(
      cart.items.map((item, position) => toSqlCartItemSave(cart.ownerUserId, item, position)),
      (item) => saveCartItem({ item }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient)),
      { discard: true },
    );
    return cart;
  });

  const clear = Effect.fn("SqlCartRepository.clear")(function* (ownerUserId: string) {
    yield* deleteCartItemsByOwner({ ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* deleteCartByOwner({ ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    return emptyCart(ownerUserId);
  });

  const getByOwnerUserId = Effect.fn("SqlCartRepository.getByOwnerUserId")(function* (
    ownerUserId: string,
  ) {
    const rows = yield* listCartItems({ ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
      Effect.flatMap(decodeSqlCartItems),
    );
    const cart: Cart = { ownerUserId, items: rows.map(toCartItem) };

    return Option.match(Option.fromUndefinedOr(cart.items[0]), {
      onNone: () => Option.none<Cart>(),
      onSome: () => Option.some(cart),
    });
  });

  return { clear, getByOwnerUserId, save } as const;
});

export const SqlCartRepositoryLive = Layer.effect(
  CartRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlCartQueries;

    return CartRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        queries
          .getByOwnerUserId(ownerUserId)
          .pipe(PersistenceError.refail(`Failed to load cart "${ownerUserId}"`)),
      save: (cart) =>
        queries
          .save(cart)
          .pipe(PersistenceError.refail(`Failed to save cart "${cart.ownerUserId}"`)),
      clear: (ownerUserId) =>
        queries
          .clear(ownerUserId)
          .pipe(PersistenceError.refail(`Failed to clear cart "${ownerUserId}"`)),
    });
  }),
);
