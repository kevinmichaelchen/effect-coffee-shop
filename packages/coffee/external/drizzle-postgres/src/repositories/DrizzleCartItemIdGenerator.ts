/**
 * Allocates cart item identifiers from the Postgres backing store.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CartItemIdFactory } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartItemIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CartItemIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/type-id-generator";

export const DrizzleCartItemIdGeneratorLive = Layer.succeed(
  CartItemIdGenerator,
  CartItemIdGenerator.of(makeTypeIdGenerator(CartItemIdFactory)),
);
