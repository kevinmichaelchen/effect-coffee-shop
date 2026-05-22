/**
 * Allocates checkout session identifiers from the Postgres backing store.
 *
 * @module
 */
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { sql } from "drizzle-orm";
import { checkoutSessionIdFromString } from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { makePaddedIdFormatter } from "@effect-coffee-shop/coffee-core/application/ports/monotonic-id-generator";
import { CoffeeDb } from "../db/Db.ts";
import { CheckoutSessionIdSequenceRowSchema } from "../db/models.ts";

const decodeCheckoutSessionIdSequenceRow = Schema.decodeUnknownEffect(
  CheckoutSessionIdSequenceRowSchema,
);

const formatCheckoutSessionId = makePaddedIdFormatter(
  "checkout-session",
  checkoutSessionIdFromString,
);

export const DrizzleCheckoutSessionIdGeneratorLive = Layer.effect(
  CheckoutSessionIdGenerator,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    return CheckoutSessionIdGenerator.of({
      next: db.execute(sql`select nextval('coffee_checkout_session_id_seq')::int as value`).pipe(
        Effect.flatMap((rows) =>
          Option.match(Arr.head(rows), {
            onNone: () => Effect.die("DrizzleCheckoutSessionIdGenerator.next returned no rows"),
            onSome: decodeCheckoutSessionIdSequenceRow,
          }),
        ),
        Effect.map((row) => row.value),
        Effect.map(formatCheckoutSessionId),
        Effect.orDie,
      ),
    });
  }),
);
