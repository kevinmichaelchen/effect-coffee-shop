/**
 * Allocates cart item identifiers from the Postgres backing store.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { cartItemIdFromString } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartItemIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CartItemIdGenerator";
import {
  makeMonotonicIdGenerator,
  makePaddedIdFormatter,
} from "@effect-coffee-shop/coffee-core/application/ports/monotonic-id-generator";

const formatCartItemId = makePaddedIdFormatter("cart-item", cartItemIdFromString);

export const DrizzleCartItemIdGeneratorLive = Layer.effect(
  CartItemIdGenerator,
  makeMonotonicIdGenerator(formatCartItemId).pipe(Effect.map(CartItemIdGenerator.of)),
);
