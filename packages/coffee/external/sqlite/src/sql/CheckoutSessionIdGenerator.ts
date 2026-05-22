/**
 * Allocates checkout session identifiers from the SQL backing store.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { checkoutSessionIdFromString } from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import {
  makeMonotonicIdGenerator,
  makePaddedIdFormatter,
} from "@effect-coffee-shop/coffee-core/application/ports/monotonic-id-generator";

const formatCheckoutSessionId = makePaddedIdFormatter(
  "checkout-session",
  checkoutSessionIdFromString,
);

export const SqlCheckoutSessionIdGeneratorLive = Layer.effect(
  CheckoutSessionIdGenerator,
  makeMonotonicIdGenerator(formatCheckoutSessionId).pipe(Effect.map(CheckoutSessionIdGenerator.of)),
);
