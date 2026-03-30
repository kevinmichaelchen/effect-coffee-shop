import * as Effect from "effect/Effect";
import { InvalidOrderInputError } from "#domain/errors";
import { isOrderStatus, type CoffeeOrders, type ListOrdersRequest } from "#domain/order";
import { OrderRepository } from "../ports/OrderRepository.ts";

export const listOrders = Effect.fn("CoffeeOrders.listOrders")(function* (
  request: ListOrdersRequest,
): Effect.fn.Return<CoffeeOrders, InvalidOrderInputError, OrderRepository> {
  const orderRepository = yield* OrderRepository;

  if (request.status === undefined) {
    return yield* orderRepository.list();
  }

  if (!isOrderStatus(request.status)) {
    return yield* new InvalidOrderInputError({
      message: `status "${request.status}" is not supported`,
    });
  }

  return yield* orderRepository.list({ status: request.status });
});
