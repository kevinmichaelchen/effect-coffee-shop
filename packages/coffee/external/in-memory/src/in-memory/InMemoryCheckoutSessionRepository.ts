/**
 * Stores checkout sessions in memory for local and test runtimes.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import type {
  CheckoutSession,
  CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { makeCheckoutSessionRepository } from "./checkout-session-store.ts";

export const InMemoryCheckoutSessionRepositoryLive = Layer.effect(
  CheckoutSessionRepository,
  Effect.gen(function* () {
    const sessions = yield* Ref.make(HashMap.empty<CheckoutSessionId, CheckoutSession>());

    return makeCheckoutSessionRepository(sessions);
  }),
);
