/**
 * Resolves Coffee order items through cached Effect requests.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Request from "effect/Request";
import * as RequestResolver from "effect/RequestResolver";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import type { CoffeeOrderItem } from "@effect-coffee-shop/coffee-core/domain/order";
import type { OrderItemInput } from "../contracts.ts";
import { InternalAppError } from "../errors.ts";
import { MenuRepository } from "../ports/MenuRepository.ts";
import { resolveOrderItem } from "./orderItemResolution.ts";

type OrderItemResolutionError = DrinkNotFoundError | InvalidOrderInputError | InternalAppError;

class ResolveOrderItemRequest extends Request.TaggedClass("ResolveOrderItemRequest")<
  {
    readonly input: OrderItemInput;
  },
  CoffeeOrderItem,
  OrderItemResolutionError
> {}

export const resolveOrderItems = Effect.fnUntraced(function* (
  items: readonly OrderItemInput[],
): Effect.fn.Return<readonly CoffeeOrderItem[], OrderItemResolutionError, MenuRepository> {
  const menuRepository = yield* MenuRepository;
  const resolver = yield* RequestResolver.fromEffect(
    (entry: Request.Entry<ResolveOrderItemRequest>) =>
      resolveOrderItem(entry.request.input).pipe(
        Effect.provideService(MenuRepository, menuRepository),
      ),
  ).pipe(RequestResolver.withCache({ capacity: 128 }));

  return yield* Effect.forEach(
    items,
    (input) => Effect.request(new ResolveOrderItemRequest({ input }), resolver),
    { concurrency: "unbounded" },
  );
});
