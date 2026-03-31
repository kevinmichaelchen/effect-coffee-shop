import * as Effect from "effect/Effect";
import { InvalidOrderInputError } from "#domain/errors";
import { isOrderStatus, type CoffeeOrders } from "#domain/order";
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { type ListOrdersRequest } from "../contracts.ts";

export const listOrders = Effect.fn("CoffeeOrders.listOrders")(function* (
  request: ListOrdersRequest,
): Effect.fn.Return<CoffeeOrders, InvalidOrderInputError | InternalAppError, OrderRepository> {
  const orderRepository = yield* OrderRepository;

  if (request.status === undefined) {
    return yield* orderRepository
      .list()
      .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to list orders right now")));
  }

  if (!isOrderStatus(request.status)) {
    return yield* new InvalidOrderInputError({
      message: `status "${request.status}" is not supported`,
    });
  }

  return yield* orderRepository
    .list({ status: request.status })
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to list orders right now")));
});
