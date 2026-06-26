/**
 * Allocates checkout session identifiers from the Postgres backing store.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CheckoutSessionIdFactory } from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/type-id-generator";

export const DrizzleCheckoutSessionIdGeneratorLive = Layer.succeed(
  CheckoutSessionIdGenerator,
  CheckoutSessionIdGenerator.of(makeTypeIdGenerator(CheckoutSessionIdFactory)),
);
