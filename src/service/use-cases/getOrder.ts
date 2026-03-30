import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { OrderNotFoundError } from "#domain/errors";
import type { CoffeeOrder, OrderId } from "#domain/order";
import { OrderRepository } from "../ports/OrderRepository.ts";

export const getOrder = Effect.fn("CoffeeOrders.getOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<CoffeeOrder, OrderNotFoundError, OrderRepository> {
  const orderRepository = yield* OrderRepository;
  const maybeOrder = yield* orderRepository.getById(orderId);

  if (Option.isNone(maybeOrder)) {
    return yield* new OrderNotFoundError({ orderId });
  }

  return maybeOrder.value;
});
