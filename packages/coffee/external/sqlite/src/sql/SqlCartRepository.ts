import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { Cart } from "@effect-coffee-shop/coffee-core/domain/cart";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CartRepository } from "@effect-coffee-shop/coffee-core/application/ports/CartRepository";
import { SqlCartItemModel, toCartItem, toSqlCartItemSave } from "./models.ts";

const decodeSqlCartItems = Schema.decodeUnknownEffect(Schema.Array(SqlCartItemModel));

const insertCartSql = `
insert into carts (owner_user_id)
values (?)
on conflict (owner_user_id) do nothing
`.trim();

const insertCartItemSql = `
insert into cart_items (
  owner_user_id,
  id,
  position,
  drink_id,
  size,
  milk,
  temperature,
  shots,
  notes,
  quantity
)
values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`.trim();

const listCartItemsSql = `
select owner_user_id, id, position, drink_id, size, milk, temperature, shots, notes, quantity
from cart_items
where owner_user_id = ?
order by position
`.trim();

const emptyCart = (ownerUserId: string): Cart => ({
  ownerUserId,
  items: [],
});

const loadCart = (sqlClient: SqlClient.SqlClient, ownerUserId: string) =>
  sqlClient.unsafe<Record<string, unknown>>(listCartItemsSql, [ownerUserId]).pipe(
    Effect.flatMap(decodeSqlCartItems),
    Effect.map((items): Cart => ({ ownerUserId, items: items.map(toCartItem) })),
  );

const makeSqlCartQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlCartRepository.save")(function* (cart: Cart) {
    yield* sqlClient.unsafe(insertCartSql, [cart.ownerUserId]);
    yield* sqlClient.unsafe("delete from cart_items where owner_user_id = ?", [cart.ownerUserId]);
    yield* Effect.forEach(
      cart.items.map((item, position) => toSqlCartItemSave(cart.ownerUserId, item, position)),
      (item) =>
        sqlClient.unsafe(insertCartItemSql, [
          item.owner_user_id,
          item.id,
          item.position,
          item.drink_id,
          item.size,
          item.milk,
          item.temperature,
          item.shots,
          item.notes,
          item.quantity,
        ]),
      { discard: true },
    );
    return cart;
  });

  const clear = Effect.fn("SqlCartRepository.clear")(function* (ownerUserId: string) {
    yield* sqlClient.unsafe("delete from cart_items where owner_user_id = ?", [ownerUserId]);
    yield* sqlClient.unsafe("delete from carts where owner_user_id = ?", [ownerUserId]);
    return emptyCart(ownerUserId);
  });

  const getByOwnerUserId = Effect.fn("SqlCartRepository.getByOwnerUserId")(function* (
    ownerUserId: string,
  ) {
    const cart = yield* loadCart(sqlClient, ownerUserId);
    return cart.items.length === 0 ? Option.none<Cart>() : Option.some(cart);
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
