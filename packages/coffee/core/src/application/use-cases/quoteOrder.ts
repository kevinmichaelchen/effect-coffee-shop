/**
 * Quotes and validates proposed Coffee orders without persisting them.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import type { DrinkNotFoundError, InvalidOrderInputError } from "../../domain/errors.ts";
import type { OrderQuote, QuoteOrderRequest } from "../contracts.ts";
import type { InternalAppError } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { resolveOrderQuote } from "./orderItems.ts";

export const quoteOrder = Effect.fn("CoffeeOrders.quoteOrder")(function* (
  request: QuoteOrderRequest,
): Effect.fn.Return<
  OrderQuote,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  return yield* resolveOrderQuote(request.items);
});

export const validateOrder = Effect.fn("CoffeeOrders.validateOrder")(function* (
  request: QuoteOrderRequest,
): Effect.fn.Return<
  OrderQuote,
  DrinkNotFoundError | InvalidOrderInputError | InternalAppError,
  MenuRepository
> {
  return yield* resolveOrderQuote(request.items);
});
