/**
 * Persists checkout sessions with Drizzle/Postgres.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { CoffeeDb } from "../db/Db.ts";
import {
  clearCurrentCheckoutSessionByOwnerUserId,
  loadCheckoutSessionById,
  loadCurrentCheckoutSessionByOwnerUserId,
  saveCheckoutSession,
} from "./checkout-session-persistence.ts";

export const DrizzleCheckoutSessionRepositoryLive = Layer.effect(
  CheckoutSessionRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    return CheckoutSessionRepository.of({
      getById: (id) =>
        loadCheckoutSessionById(db, id).pipe(
          PersistenceError.refail(`Failed to load checkout session "${id}"`),
        ),
      getCurrentByOwnerUserId: (ownerUserId) =>
        loadCurrentCheckoutSessionByOwnerUserId(db, ownerUserId).pipe(
          PersistenceError.refail(`Failed to load checkout session for "${ownerUserId}"`),
        ),
      save: (session) =>
        saveCheckoutSession(db, session).pipe(
          PersistenceError.refail(`Failed to save checkout session "${session.id}"`),
        ),
      clearCurrentByOwnerUserId: (ownerUserId) =>
        clearCurrentCheckoutSessionByOwnerUserId(db, ownerUserId).pipe(
          PersistenceError.refail(`Failed to clear checkout session for "${ownerUserId}"`),
        ),
    });
  }),
);
