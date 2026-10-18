import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { generateTypedId, typedIdPattern } from "../TypedId.ts";

/** One line in a cart, such as `cart_item_01j…`. */
export const CartItemId = Schema.String.check(typedIdPattern("cart_item"))
  .pipe(Schema.brand("CartItemId"))
  .annotate({
    identifier: "CartItemId",
    description: "Cart line id, such as cart_item_01j9z3k6a0x8s5v2c4b7n1m3p6.",
  });
export type CartItemId = typeof CartItemId.Type;
export const makeCartItemId = generateTypedId("cart_item").pipe(
  Effect.map((id) => CartItemId.make(id)),
);
