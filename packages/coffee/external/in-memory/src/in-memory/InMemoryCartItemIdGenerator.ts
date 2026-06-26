/**
 * Provides deterministic in-memory cart item identifiers.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CartItemIdFactory } from "@effect-coffee-shop/coffee-core/domain/cart";
import { CartItemIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CartItemIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/type-id-generator";

export const InMemoryCartItemIdGeneratorLive = Layer.succeed(
  CartItemIdGenerator,
  CartItemIdGenerator.of(makeTypeIdGenerator(CartItemIdFactory)),
);
