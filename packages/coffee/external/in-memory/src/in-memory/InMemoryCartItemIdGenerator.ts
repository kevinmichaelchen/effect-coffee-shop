/**
 * Provides deterministic in-memory cart item identifiers.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CartItemIdFactory } from "@effect-coffee-shop/coffee-domain/cart";
import { CartItemIdGenerator } from "@effect-coffee-shop/coffee-application/ports/CartItemIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-application/ports/type-id-generator";

export const InMemoryCartItemIdGeneratorLive = Layer.succeed(
  CartItemIdGenerator,
  CartItemIdGenerator.of(makeTypeIdGenerator(CartItemIdFactory)),
);
