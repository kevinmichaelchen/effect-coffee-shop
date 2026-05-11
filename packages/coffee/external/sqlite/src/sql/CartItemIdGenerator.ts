import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { cartItemIdFromString, type CartItemId } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartItemIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CartItemIdGenerator";

const formatCartItemId = (currentId: number): CartItemId =>
  cartItemIdFromString(`cart-item-${String(currentId).padStart(4, "0")}`);

export const SqlCartItemIdGeneratorLive = Layer.effect(
  CartItemIdGenerator,
  Effect.sync(() => {
    let currentId = 0;

    return CartItemIdGenerator.of({
      next: Effect.sync(() => {
        currentId += 1;
        return formatCartItemId(currentId);
      }),
    });
  }),
);
