/**
 * Loads and saves checkout session rows with Drizzle/Postgres.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { and, asc, desc, eq } from "drizzle-orm";
import type {
  CheckoutSession,
  CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CoffeeDb } from "../db/Db.ts";
import {
  DrizzleCheckoutSessionItemRowSchema,
  DrizzleCheckoutSessionRowSchema,
  toCheckoutSession,
  toCheckoutSessionInsert,
  toCheckoutSessionItemInsert,
} from "../db/models.ts";
import { checkoutSessionItemsTable, checkoutSessionsTable } from "../db/schema.ts";

type Db = CoffeeDb["Service"];
type DrizzleCheckoutSessionRow = typeof DrizzleCheckoutSessionRowSchema.Type;

const decodeCheckoutSessionRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzleCheckoutSessionRowSchema),
);
const decodeCheckoutSessionItemRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzleCheckoutSessionItemRowSchema),
);

const listItems = (db: Db, sessionId: CheckoutSessionId) =>
  db
    .select()
    .from(checkoutSessionItemsTable)
    .where(eq(checkoutSessionItemsTable.sessionId, sessionId))
    .orderBy(asc(checkoutSessionItemsTable.position))
    .pipe(Effect.flatMap(decodeCheckoutSessionItemRows));

const loadSession = (db: Db, session: DrizzleCheckoutSessionRow) =>
  listItems(db, session.id).pipe(Effect.map((items) => toCheckoutSession(session, items)));

const loadOptionalSession = (db: Db, sessions: ReadonlyArray<DrizzleCheckoutSessionRow>) =>
  Option.match(Option.fromUndefinedOr(sessions[0]), {
    onNone: () => Effect.succeed(Option.none<CheckoutSession>()),
    onSome: (session) => loadSession(db, session).pipe(Effect.map(Option.some)),
  });

export const saveCheckoutSession = (db: Db, session: CheckoutSession) =>
  Effect.gen(function* () {
    const row = toCheckoutSessionInsert(session);

    yield* db.insert(checkoutSessionsTable).values(row).onConflictDoUpdate({
      target: checkoutSessionsTable.id,
      set: row,
    });
    yield* db
      .delete(checkoutSessionItemsTable)
      .where(eq(checkoutSessionItemsTable.sessionId, session.id));
    yield* Effect.forEach(
      session.items.map((item, position) =>
        toCheckoutSessionItemInsert(session.id, item, position),
      ),
      (item) => db.insert(checkoutSessionItemsTable).values(item),
      { concurrency: 1, discard: true },
    );

    return session;
  });

export const loadCheckoutSessionById = (db: Db, id: CheckoutSessionId) =>
  db
    .select()
    .from(checkoutSessionsTable)
    .where(eq(checkoutSessionsTable.id, id))
    .pipe(
      Effect.flatMap(decodeCheckoutSessionRows),
      Effect.flatMap((rows) => loadOptionalSession(db, rows)),
    );

export const loadCurrentCheckoutSessionByOwnerUserId = (db: Db, ownerUserId: string) =>
  db
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
    .pipe(
      Effect.flatMap(decodeCheckoutSessionRows),
      Effect.flatMap((rows) => loadOptionalSession(db, rows)),
    );

export const clearCurrentCheckoutSessionByOwnerUserId = (db: Db, ownerUserId: string) =>
  Effect.gen(function* () {
    const current = yield* loadCurrentCheckoutSessionByOwnerUserId(db, ownerUserId);
    yield* Option.match(current, {
      onNone: () => Effect.void,
      onSome: (session) =>
        db.delete(checkoutSessionsTable).where(eq(checkoutSessionsTable.id, session.id)),
    });
  });
