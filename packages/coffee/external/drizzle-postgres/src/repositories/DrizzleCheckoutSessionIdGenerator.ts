import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { sql } from "drizzle-orm";
import {
  checkoutSessionIdFromString,
  type CheckoutSessionId,
} from "@effect-coffee-shop/coffee-core/domain/checkout-session";
import { CheckoutSessionIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/CheckoutSessionIdGenerator";
import { CoffeeDb } from "../db/Db.ts";
import { CheckoutSessionIdSequenceRowSchema } from "../db/models.ts";

const decodeCheckoutSessionIdSequenceRow = Schema.decodeUnknownEffect(
  CheckoutSessionIdSequenceRowSchema,
);

const formatCheckoutSessionId = (currentId: number): CheckoutSessionId =>
  checkoutSessionIdFromString(`checkout-session-${String(currentId).padStart(4, "0")}`);

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
