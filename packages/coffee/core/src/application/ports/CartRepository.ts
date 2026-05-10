import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type { Cart } from "../../domain/cart.ts";
import type { PersistenceError } from "../errors.ts";

export class CartRepository extends Context.Service<
  CartRepository,
  {
    readonly getByOwnerUserId: (
      ownerUserId: string,
    ) => Effect.Effect<Option.Option<Cart>, PersistenceError>;
    readonly save: (cart: Cart) => Effect.Effect<Cart, PersistenceError>;
    readonly clear: (ownerUserId: string) => Effect.Effect<Cart, PersistenceError>;
  }
>()("effect-coffee-shop/application/CartRepository") {}
