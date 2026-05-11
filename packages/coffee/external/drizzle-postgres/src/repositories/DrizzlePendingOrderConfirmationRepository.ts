import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { asc, eq } from "drizzle-orm";
import type { PendingOrderConfirmation } from "@effect-coffee-shop/coffee-core/domain/pending-order-confirmation";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { PendingOrderConfirmationRepository } from "@effect-coffee-shop/coffee-core/application/ports/PendingOrderConfirmationRepository";
import { CoffeeDb } from "../db/Db.ts";
import {
  DrizzlePendingOrderConfirmationItemRowSchema,
  DrizzlePendingOrderConfirmationRowSchema,
  toPendingOrderConfirmation,
  toPendingOrderConfirmationInsert,
  toPendingOrderConfirmationItemInsert,
} from "../db/models.ts";
import {
  pendingOrderConfirmationItemsTable,
  pendingOrderConfirmationsTable,
} from "../db/schema.ts";

const decodePendingOrderConfirmationRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzlePendingOrderConfirmationRowSchema),
);
const decodePendingOrderConfirmationItemRows = Schema.decodeUnknownEffect(
  Schema.Array(DrizzlePendingOrderConfirmationItemRowSchema),
);

export const DrizzlePendingOrderConfirmationRepositoryLive = Layer.effect(
  PendingOrderConfirmationRepository,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    const save = Effect.fn("DrizzlePendingOrderConfirmationRepository.save")(function* (
      confirmation: PendingOrderConfirmation,
    ) {
      const header = toPendingOrderConfirmationInsert(confirmation);
      yield* db.insert(pendingOrderConfirmationsTable).values(header).onConflictDoUpdate({
        target: pendingOrderConfirmationsTable.ownerUserId,
        set: header,
      });
      yield* db
        .delete(pendingOrderConfirmationItemsTable)
        .where(eq(pendingOrderConfirmationItemsTable.ownerUserId, confirmation.ownerUserId));
      yield* Effect.forEach(
        confirmation.items.map((item, position) =>
          toPendingOrderConfirmationItemInsert(confirmation.ownerUserId, item, position),
        ),
        (item) => db.insert(pendingOrderConfirmationItemsTable).values(item),
        { discard: true },
      );
      return confirmation;
    });

    const clear = Effect.fn("DrizzlePendingOrderConfirmationRepository.clear")(function* (
      ownerUserId: string,
    ) {
      yield* db
        .delete(pendingOrderConfirmationItemsTable)
        .where(eq(pendingOrderConfirmationItemsTable.ownerUserId, ownerUserId));
      yield* db
        .delete(pendingOrderConfirmationsTable)
        .where(eq(pendingOrderConfirmationsTable.ownerUserId, ownerUserId));
    });

    const getByOwnerUserId = Effect.fn(
      "DrizzlePendingOrderConfirmationRepository.getByOwnerUserId",
    )(function* (ownerUserId: string) {
      const rows = yield* db
        .select()
        .from(pendingOrderConfirmationsTable)
        .where(eq(pendingOrderConfirmationsTable.ownerUserId, ownerUserId))
        .pipe(Effect.flatMap(decodePendingOrderConfirmationRows));
      const confirmation = Option.fromUndefinedOr(rows[0]);

      return yield* Option.match(confirmation, {
        onNone: () => Effect.succeed(Option.none<PendingOrderConfirmation>()),
        onSome: (header) =>
          db
            .select()
            .from(pendingOrderConfirmationItemsTable)
            .where(eq(pendingOrderConfirmationItemsTable.ownerUserId, ownerUserId))
            .orderBy(asc(pendingOrderConfirmationItemsTable.position))
            .pipe(
              Effect.flatMap(decodePendingOrderConfirmationItemRows),
              Effect.map((items) => Option.some(toPendingOrderConfirmation(header, items))),
            ),
      });
    });

    return PendingOrderConfirmationRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        getByOwnerUserId(ownerUserId).pipe(
          PersistenceError.refail(`Failed to load pending order confirmation "${ownerUserId}"`),
        ),
      save: (confirmation) =>
        save(confirmation).pipe(
          PersistenceError.refail(
            `Failed to save pending order confirmation "${confirmation.ownerUserId}"`,
          ),
        ),
      clear: (ownerUserId) =>
        clear(ownerUserId).pipe(
          PersistenceError.refail(`Failed to clear pending order confirmation "${ownerUserId}"`),
        ),
    });
  }),
);
