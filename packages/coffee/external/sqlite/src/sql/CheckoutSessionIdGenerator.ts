/**
 * Allocates checkout session identifiers from the SQL backing store.
 *
 * @module
 */
import * as Layer from "effect/Layer";
import { CheckoutSessionIdFactory } from "@effect-coffee-shop/coffee-domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-application/ports/CheckoutSessionIdGenerator";
import { makeTypeIdGenerator } from "@effect-coffee-shop/coffee-application/ports/type-id-generator";

export const SqlCheckoutSessionIdGeneratorLive = Layer.succeed(
  CheckoutSessionIdGenerator,
  CheckoutSessionIdGenerator.of(makeTypeIdGenerator(CheckoutSessionIdFactory)),
);
