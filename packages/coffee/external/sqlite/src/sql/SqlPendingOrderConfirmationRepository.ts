import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import type { PendingOrderConfirmation } from "@effect-coffee-shop/coffee-core/domain/pending-order-confirmation";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { PendingOrderConfirmationRepository } from "@effect-coffee-shop/coffee-core/application/ports/PendingOrderConfirmationRepository";
import {
  SqlPendingOrderConfirmationItemModel,
  SqlPendingOrderConfirmationModel,
  toPendingOrderConfirmation,
  toSqlPendingOrderConfirmationItemSave,
  toSqlPendingOrderConfirmationSave,
} from "./models.ts";
import { deletePendingOrderConfirmationByOwner } from "./queries/.generated/delete-pending-order-confirmation-by-owner.sql.ts";
import { deletePendingOrderConfirmationItemsByOwner } from "./queries/.generated/delete-pending-order-confirmation-items-by-owner.sql.ts";
import { findPendingOrderConfirmation } from "./queries/.generated/find-pending-order-confirmation.sql.ts";
import { listPendingOrderConfirmationItems } from "./queries/.generated/list-pending-order-confirmation-items.sql.ts";
import { savePendingOrderConfirmation } from "./queries/.generated/save-pending-order-confirmation.sql.ts";
import { savePendingOrderConfirmationItem } from "./queries/.generated/save-pending-order-confirmation-item.sql.ts";

const decodeSqlPendingOrderConfirmation = Schema.decodeUnknownEffect(
  SqlPendingOrderConfirmationModel,
);
const decodeSqlPendingOrderConfirmationItems = Schema.decodeUnknownEffect(
  Schema.Array(SqlPendingOrderConfirmationItemModel),
);

const makeSqlPendingOrderConfirmationQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const save = Effect.fn("SqlPendingOrderConfirmationRepository.save")(function* (
    confirmation: PendingOrderConfirmation,
  ) {
    const header = toSqlPendingOrderConfirmationSave(confirmation);
    yield* savePendingOrderConfirmation({
      param1: header.ownerUserId,
      param2: header.confirmationId,
      param3: header.source,
      param4: header.totalPriceCents,
      param5: header.updatedAt,
    }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient));
    yield* deletePendingOrderConfirmationItemsByOwner({ param1: confirmation.ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* Effect.forEach(
      confirmation.items.map((item, position) =>
        toSqlPendingOrderConfirmationItemSave(confirmation.ownerUserId, item, position),
      ),
      (item) =>
        savePendingOrderConfirmationItem({
          param1: item.ownerUserId,
          param2: item.position,
          param3: item.drinkId,
          param4: item.drinkName,
          param5: item.size,
          param6: item.milk,
          param7: item.temperature,
          param8: item.shots,
          param9: item.notes,
          param10: item.quantity,
          param11: item.unitPriceCents,
          param12: item.lineTotalCents,
        }).pipe(Effect.provideService(SqlClient.SqlClient, sqlClient)),
      { discard: true },
    );
    return confirmation;
  });

  const clear = Effect.fn("SqlPendingOrderConfirmationRepository.clear")(function* (
    ownerUserId: string,
  ) {
    yield* deletePendingOrderConfirmationItemsByOwner({ param1: ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* deletePendingOrderConfirmationByOwner({ param1: ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
  });

  const getByOwnerUserId = Effect.fn("SqlPendingOrderConfirmationRepository.getByOwnerUserId")(
    function* (ownerUserId: string) {
      const header = yield* findPendingOrderConfirmation({ param1: ownerUserId }).pipe(
        Effect.provideService(SqlClient.SqlClient, sqlClient),
        Effect.flatMap((row) =>
          Option.match(Option.fromNullishOr(row), {
            onNone: () => Effect.succeed(Option.none()),
            onSome: (value) =>
              decodeSqlPendingOrderConfirmation(value).pipe(Effect.map(Option.some)),
          }),
        ),
      );

      return yield* Option.match(header, {
        onNone: () => Effect.succeed(Option.none<PendingOrderConfirmation>()),
        onSome: (confirmation) =>
          listPendingOrderConfirmationItems({ param1: ownerUserId }).pipe(
            Effect.provideService(SqlClient.SqlClient, sqlClient),
            Effect.flatMap(decodeSqlPendingOrderConfirmationItems),
            Effect.map((items) => Option.some(toPendingOrderConfirmation(confirmation, items))),
          ),
      });
    },
  );

  return { clear, getByOwnerUserId, save } as const;
});

export const SqlPendingOrderConfirmationRepositoryLive = Layer.effect(
  PendingOrderConfirmationRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlPendingOrderConfirmationQueries;

    return PendingOrderConfirmationRepository.of({
      getByOwnerUserId: (ownerUserId) =>
        queries
          .getByOwnerUserId(ownerUserId)
          .pipe(
            PersistenceError.refail(`Failed to load pending order confirmation "${ownerUserId}"`),
          ),
      save: (confirmation) =>
        queries
          .save(confirmation)
          .pipe(
            PersistenceError.refail(
              `Failed to save pending order confirmation "${confirmation.ownerUserId}"`,
            ),
          ),
      clear: (ownerUserId) =>
        queries
          .clear(ownerUserId)
          .pipe(
            PersistenceError.refail(`Failed to clear pending order confirmation "${ownerUserId}"`),
          ),
    });
  }),
);
