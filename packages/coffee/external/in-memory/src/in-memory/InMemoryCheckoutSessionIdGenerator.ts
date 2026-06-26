/**
 * Provides deterministic in-memory checkout session identifiers.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CheckoutSessionIdFactory } from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/type-id-generator";

export const InMemoryCheckoutSessionIdGeneratorLive = Layer.succeed(
  CheckoutSessionIdGenerator,
  CheckoutSessionIdGenerator.of(makeTypeIdGenerator(CheckoutSessionIdFactory)),
);
