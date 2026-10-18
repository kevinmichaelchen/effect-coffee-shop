import * as Domain from "alchemy/Domain";
import { CartItemId } from "./CartItem.id.ts";

/** The cart has no line with this id. */
export class CartItemNotFound extends Domain.Rejection("CartItemNotFound", {
  cartItemId: CartItemId,
}) {}
