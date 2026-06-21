/**
 * Builds priced Coffee order quotes from requested items.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { sumMoney } from "@effect-coffee-shop/coffee-core/domain/money";
import { CoffeeOrderItemSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import type { OrderItemInput, OrderQuote } from "../contracts.ts";
import { InternalAppError } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { invalidOrderInput } from "./orderItemOptions.ts";
import { resolveOrderItems } from "./orderItemRequests.ts";

const decodeResolvedItems = Schema.decodeUnknownEffect(
  Schema.NonEmptyArray(Schema.toType(CoffeeOrderItemSchema)),
);

export const resolveOrderQuote = Effect.fnUntraced(function* (
  items: readonly OrderItemInput[],
): Effect.fn.Return<
  OrderQuote,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  yield* Effect.succeed(items).pipe(
    Effect.filterOrFail(
      (inputItems) => inputItems.length > 0,
      () => invalidOrderInput("items must include at least one drink"),
    ),
  );

  const resolvedItemArray = yield* resolveOrderItems(items);
  const resolvedItems = yield* decodeResolvedItems(resolvedItemArray).pipe(
    Effect.catchTag("SchemaError", () =>
      Effect.fail(invalidOrderInput("items must include at least one drink")),
    ),
  );

  return {
    items: resolvedItems,
    totalPrice: sumMoney(resolvedItems.map((item) => item.lineTotal)),
  };
});
