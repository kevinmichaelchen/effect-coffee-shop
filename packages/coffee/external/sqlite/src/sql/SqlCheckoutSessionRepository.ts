import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { SqlClient } from "effect/unstable/sql";
import {
  CheckoutSessionIdSchema,
  CheckoutSessionSchema,
  CheckoutSessionStatusSchema,
  type CheckoutSession,
  type CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { MoneyFromCentsSchema, moneyToCents } from "@effect-coffee-shop/coffee-core/domain/money";
import {
  CoffeeOrderItemSchema,
  type CoffeeOrderItem,
} from "@effect-coffee-shop/coffee-core/domain/order";
import { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";
import { CheckoutSessionRepository } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionRepository";
import { toPersistedCoffeeOrderItemFields } from "@effect-coffee-shop/coffee-core/application/ports/coffee-order-item-persistence";
import { deleteCheckoutSessionItemsBySessionId } from "./queries/.generated/delete-checkout-session-items-by-session-id.sql.ts";
import { deleteCurrentCheckoutSessionByOwner } from "./queries/.generated/delete-current-checkout-session-by-owner.sql.ts";
import { findCheckoutSessionById } from "./queries/.generated/find-checkout-session-by-id.sql.ts";
import { findCurrentCheckoutSessionByOwner } from "./queries/.generated/find-current-checkout-session-by-owner.sql.ts";
import { listCheckoutSessionItems } from "./queries/.generated/list-checkout-session-items.sql.ts";
import { saveCheckoutSession } from "./queries/.generated/save-checkout-session.sql.ts";
import { saveCheckoutSessionItem } from "./queries/.generated/save-checkout-session-item.sql.ts";

const NullableStringOptionSchema = Schema.OptionFromNullishOr(Schema.String, {
  onNoneEncoding: null,
});

const CheckoutSessionRowSchema = Schema.Struct({
  id: CheckoutSessionIdSchema,
  ownerUserId: Schema.String,
  status: CheckoutSessionStatusSchema,
  totalPrice: MoneyFromCentsSchema,
  createdAt: Schema.DateTimeUtcFromString,
  updatedAt: Schema.DateTimeUtcFromString,
  expiresAt: Schema.DateTimeUtcFromString,
}).pipe(
  Schema.encodeKeys({
    ownerUserId: "owner_user_id",
    totalPrice: "total_price_cents",
    createdAt: "created_at",
    updatedAt: "updated_at",
    expiresAt: "expires_at",
  }),
);

const CheckoutSessionItemRowSchema = Schema.Struct({
  sessionId: CheckoutSessionIdSchema,
  position: Schema.Int,
  drinkId: Schema.String,
  drinkName: Schema.String,
  size: Schema.String,
  milk: Schema.String,
  temperature: Schema.String,
  shots: Schema.Int,
  notes: NullableStringOptionSchema,
  quantity: Schema.Int,
  unitPrice: MoneyFromCentsSchema,
  lineTotal: MoneyFromCentsSchema,
}).pipe(
  Schema.encodeKeys({
    sessionId: "session_id",
    drinkId: "drink_id",
    drinkName: "drink_name",
    unitPrice: "unit_price_cents",
    lineTotal: "line_total_cents",
  }),
);

type CheckoutSessionRow = typeof CheckoutSessionRowSchema.Type;
type CheckoutSessionItemRow = typeof CheckoutSessionItemRowSchema.Type;

const decodeCheckoutSessionRow = Schema.decodeUnknownEffect(CheckoutSessionRowSchema);
const decodeCheckoutSessionItemRows = Schema.decodeUnknownEffect(
  Schema.Array(CheckoutSessionItemRowSchema),
);
const decodeCheckoutSession = Schema.decodeUnknownEffect(Schema.toType(CheckoutSessionSchema));
const decodeCoffeeOrderItem = Schema.decodeUnknownSync(CoffeeOrderItemSchema);
const encodeDateTime = Schema.encodeSync(Schema.DateTimeUtcFromString);

const toCoffeeOrderItem = (row: CheckoutSessionItemRow): CoffeeOrderItem =>
  decodeCoffeeOrderItem({
    drinkId: row.drinkId,
    drinkName: row.drinkName,
    size: row.size,
    milk: row.milk,
    temperature: row.temperature,
    shots: row.shots,
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    lineTotal: row.lineTotal,
    ...Option.match(row.notes, {
      onNone: () => ({}),
      onSome: (notes) => ({ notes }),
    }),
  });

const toCheckoutSession = (row: CheckoutSessionRow, itemRows: readonly CheckoutSessionItemRow[]) =>
  decodeCheckoutSession({
    id: row.id,
    ownerUserId: row.ownerUserId,
    status: row.status,
    totalPrice: row.totalPrice,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    items: itemRows.map(toCoffeeOrderItem),
  });

const decodeOptionalCheckoutSessionRow = (row: unknown) =>
  Option.match(Option.fromNullishOr(row), {
    onNone: () => Effect.succeed(Option.none<CheckoutSessionRow>()),
    onSome: (row) => decodeCheckoutSessionRow(row).pipe(Effect.map(Option.some)),
  });

const toSqlCheckoutSessionSave = (session: CheckoutSession) => ({
  id: session.id,
  ownerUserId: session.ownerUserId,
  status: session.status,
  totalPriceCents: moneyToCents(session.totalPrice),
  createdAt: encodeDateTime(session.createdAt),
  updatedAt: encodeDateTime(session.updatedAt),
  expiresAt: encodeDateTime(session.expiresAt),
});

const toSqlCheckoutSessionItemSave = (
  sessionId: CheckoutSessionId,
  item: CoffeeOrderItem,
  position: number,
) => ({
  sessionId,
  position,
  ...toPersistedCoffeeOrderItemFields(item),
});

const makeSqlCheckoutSessionQueries = Effect.gen(function* () {
  const sqlClient = yield* SqlClient.SqlClient;

  const loadSession = Effect.fn("SqlCheckoutSessionRepository.loadSession")(function* (
    row: CheckoutSessionRow,
  ) {
    const items = yield* listCheckoutSessionItems({ sessionId: row.id }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
      Effect.flatMap(decodeCheckoutSessionItemRows),
    );
    return yield* toCheckoutSession(row, items);
  });

  const save = Effect.fn("SqlCheckoutSessionRepository.save")(function* (session: CheckoutSession) {
    yield* saveCheckoutSession({ session: toSqlCheckoutSessionSave(session) }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* deleteCheckoutSessionItemsBySessionId({ sessionId: session.id }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
    yield* Effect.forEach(
      session.items.map((item, position) =>
        toSqlCheckoutSessionItemSave(session.id, item, position),
      ),
      (item) =>
        saveCheckoutSessionItem({ item }).pipe(
          Effect.provideService(SqlClient.SqlClient, sqlClient),
        ),
      { concurrency: 1, discard: true },
    );
    return session;
  });

  const getById = Effect.fn("SqlCheckoutSessionRepository.getById")(function* (
    id: CheckoutSessionId,
  ) {
    const row = yield* findCheckoutSessionById({ id }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
      Effect.flatMap(decodeOptionalCheckoutSessionRow),
    );
    return yield* Option.match(row, {
      onNone: () => Effect.succeed(Option.none<CheckoutSession>()),
      onSome: (row) => loadSession(row).pipe(Effect.map(Option.some)),
    });
  });

  const getCurrentByOwnerUserId = Effect.fn("SqlCheckoutSessionRepository.getCurrentByOwnerUserId")(
    function* (ownerUserId: string) {
      const row = yield* findCurrentCheckoutSessionByOwner({ ownerUserId }).pipe(
        Effect.provideService(SqlClient.SqlClient, sqlClient),
        Effect.flatMap(decodeOptionalCheckoutSessionRow),
      );
      return yield* Option.match(row, {
        onNone: () => Effect.succeed(Option.none<CheckoutSession>()),
        onSome: (row) => loadSession(row).pipe(Effect.map(Option.some)),
      });
    },
  );

  const clearCurrentByOwnerUserId = Effect.fn(
    "SqlCheckoutSessionRepository.clearCurrentByOwnerUserId",
  )(function* (ownerUserId: string) {
    yield* deleteCurrentCheckoutSessionByOwner({ ownerUserId }).pipe(
      Effect.provideService(SqlClient.SqlClient, sqlClient),
    );
  });

  return { clearCurrentByOwnerUserId, getById, getCurrentByOwnerUserId, save } as const;
});

export const SqlCheckoutSessionRepositoryLive = Layer.effect(
  CheckoutSessionRepository,
  Effect.gen(function* () {
    const queries = yield* makeSqlCheckoutSessionQueries;

    return CheckoutSessionRepository.of({
      getById: (id) =>
        queries
          .getById(id)
          .pipe(PersistenceError.refail(`Failed to load checkout session "${id}"`)),
      getCurrentByOwnerUserId: (ownerUserId) =>
        queries
          .getCurrentByOwnerUserId(ownerUserId)
          .pipe(PersistenceError.refail(`Failed to load checkout session for "${ownerUserId}"`)),
      save: (session) =>
        queries
          .save(session)
          .pipe(PersistenceError.refail(`Failed to save checkout session "${session.id}"`)),
      clearCurrentByOwnerUserId: (ownerUserId) =>
        queries
          .clearCurrentByOwnerUserId(ownerUserId)
          .pipe(PersistenceError.refail(`Failed to clear checkout session for "${ownerUserId}"`)),
    });
  }),
);
