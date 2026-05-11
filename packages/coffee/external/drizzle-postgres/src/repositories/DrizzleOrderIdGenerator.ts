import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { sql } from "drizzle-orm";
import { orderIdFromString, type OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import { OrderIdGenerator } from "@effect-coffee-shop/coffee-core/application/ports/OrderIdGenerator";
import { CoffeeDb } from "../db/Db.ts";
import { OrderIdSequenceRowSchema } from "../db/models.ts";

const decodeOrderIdSequenceRow = Schema.decodeUnknownEffect(OrderIdSequenceRowSchema);

const formatOrderId = (currentId: number): OrderId =>
  orderIdFromString(`order-${String(currentId).padStart(4, "0")}`);

export const DrizzleOrderIdGeneratorLive = Layer.effect(
  OrderIdGenerator,
  Effect.gen(function* () {
    const db = yield* CoffeeDb;

    return OrderIdGenerator.of({
      next: db.execute(sql`select nextval('coffee_order_id_seq')::int as value`).pipe(
        Effect.flatMap((rows) =>
          Option.match(Arr.head(rows), {
            onNone: () => Effect.die("DrizzleOrderIdGenerator.next returned no rows"),
            onSome: decodeOrderIdSequenceRow,
          }),
        ),
        Effect.map((row) => row.value),
        Effect.map(formatOrderId),
        Effect.orDie,
      ),
    });
  }),
);
