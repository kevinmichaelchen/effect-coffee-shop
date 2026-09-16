import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { CartItemId } from "@effect-coffee-shop/coffee-domain/cart";

export class CartItemIdGenerator extends Context.Service<
  CartItemIdGenerator,
  {
    readonly next: Effect.Effect<CartItemId>;
  }
>()("effect-coffee-shop/application/CartItemIdGenerator") {}
