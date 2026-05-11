import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type {
  CheckoutSession,
  CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { CoffeeDb } from "../db/Db.ts";
import {
  DrizzleCheckoutSessionItemRowSchema,
  DrizzleCheckoutSessionRowSchema,
  toCheckoutSession,
  toCheckoutSessionInsert,
  toCheckoutSessionItemInsert,
} from "../db/models.ts";
import { checkoutSessionItemsTable, checkoutSessionsTable } from "../db/schema.ts";

const decodeCheckoutSessionRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzleCheckoutSessionRowSchema),
);
const decodeCheckoutSessionItemRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzleCheckoutSessionItemRowSchema),
);

export const DrizzleCheckoutSessionRepositoryLive = Layer.effect(
  CheckoutSessionRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    const listItems = (sessionId: CheckoutSessionId) =>
      db
        .select()
        .from(checkoutSessionItemsTable)
        .where(eq(checkoutSessionItemsTable.sessionId, sessionId))
        .orderBy(asc(checkoutSessionItemsTable.position))
        .pipe(Effect.flatMap(decodeCheckoutSessionItemRows));

    const loadSession = Effect.fn("DrizzleCheckoutSessionRepository.loadSession")(function* (
      session: typeof DrizzleCheckoutSessionRowSchema.Type,
    ) {
      const items = yield* listItems(session.id);
      return toCheckoutSession(session, items);
    });

    const save = Effect.fn("DrizzleCheckoutSessionRepository.save")(function* (
      session: CheckoutSession,
    ) {
      yield* db
        .insert(checkoutSessionsTable)
        .values(toCheckoutSessionInsert(session))
        .onConflictDoUpdate({
          target: checkoutSessionsTable.id,
          set: toCheckoutSessionInsert(session),
        });
      yield* db
        .delete(checkoutSessionItemsTable)
        .where(eq(checkoutSessionItemsTable.sessionId, session.id));
      yield* Effect.forEach(
        session.items.map((item, position) =>
          toCheckoutSessionItemInsert(session.id, item, position),
        ),
        (item) => db.insert(checkoutSessionItemsTable).values(item),
        { discard: true },
      );
      return session;
    });

    const getById = Effect.fn("DrizzleCheckoutSessionRepository.getById")(function* (
      id: CheckoutSessionId,
    ) {
      const sessions = yield* db
        .select()
        .from(checkoutSessionsTable)
        .where(eq(checkoutSessionsTable.id, id))
        .pipe(Effect.flatMap(decodeCheckoutSessionRows));

      return yield* Option.match(Option.fromUndefinedOr(sessions[0]), {
        onNone: () => Effect.succeed(Option.none<CheckoutSession>()),
        onSome: (session) => loadSession(session).pipe(Effect.map(Option.some)),
      });
    });

    const getCurrentByOwnerUserId = Effect.fn(
      "DrizzleCheckoutSessionRepository.getCurrentByOwnerUserId",
    )(function* (ownerUserId: string) {
      const sessions = yield* db
        .select()
        .from(checkoutSessionsTable)
        .where(
          and(
            eq(checkoutSessionsTable.ownerUserId, ownerUserId),
            eq(checkoutSessionsTable.status, "awaiting_confirmation"),
          ),
        )
        .orderBy(desc(checkoutSessionsTable.updatedAt), desc(checkoutSessionsTable.id))
        .limit(1)
        .pipe(Effect.flatMap(decodeCheckoutSessionRows));

      return yield* Option.match(Option.fromUndefinedOr(sessions[0]), {
        onNone: () => Effect.succeed(Option.none<CheckoutSession>()),
        onSome: (session) => loadSession(session).pipe(Effect.map(Option.some)),
      });
    });

    const clearCurrentByOwnerUserId = Effect.fn(
      "DrizzleCheckoutSessionRepository.clearCurrentByOwnerUserId",
    )(function* (ownerUserId: string) {
      const current = yield* getCurrentByOwnerUserId(ownerUserId);
      yield* Option.match(current, {
        onNone: () => Effect.void,
        onSome: (session) =>
          db.delete(checkoutSessionsTable).where(eq(checkoutSessionsTable.id, session.id)),
      });
    });

    return CheckoutSessionRepository.of({
      getById: (id) =>
        getById(id).pipe(PersistenceError.refail(`Failed to load checkout session "${id}"`)),
      getCurrentByOwnerUserId: (ownerUserId) =>
        getCurrentByOwnerUserId(ownerUserId).pipe(
          PersistenceError.refail(`Failed to load checkout session for "${ownerUserId}"`),
        ),
      save: (session) =>
        save(session).pipe(
          PersistenceError.refail(`Failed to save checkout session "${session.id}"`),
        ),
      clearCurrentByOwnerUserId: (ownerUserId) =>
        clearCurrentByOwnerUserId(ownerUserId).pipe(
          PersistenceError.refail(`Failed to clear checkout session for "${ownerUserId}"`),
        ),
    });
  }),
);
