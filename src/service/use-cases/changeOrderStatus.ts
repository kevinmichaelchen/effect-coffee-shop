import * as Effect from "effect/Effect";
import { InvalidOrderStatusTransitionError, OrderNotFoundError } from "#domain/errors";
import { canTransitionTo, type CoffeeOrder, type OrderId, type OrderStatus } from "#domain/order";
import { OrderRepository } from "../ports/OrderRepository.ts";

const updateOrderStatus = Effect.fn("CoffeeOrders.updateOrderStatus")(function* (
  orderId: OrderId,
  to: OrderStatus,
): Effect.fn.Return<
  CoffeeOrder,
  InvalidOrderStatusTransitionError | OrderNotFoundError,
  OrderRepository
> {
  const orderRepository = yield* OrderRepository;
  const order = yield* orderRepository.getById(orderId);

  if (order === undefined) {
    return yield* new OrderNotFoundError({ orderId });
  }

  if (!canTransitionTo(order.status, to)) {
    return yield* new InvalidOrderStatusTransitionError({
      orderId,
      from: order.status,
      to,
    });
  }

  return yield* orderRepository.save({
    ...order,
    status: to,
  });
});

export const startBrewing = Effect.fn("CoffeeOrders.startBrewing")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  InvalidOrderStatusTransitionError | OrderNotFoundError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "brewing");
});

export const markReady = Effect.fn("CoffeeOrders.markReady")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  InvalidOrderStatusTransitionError | OrderNotFoundError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "ready");
});

export const pickUpOrder = Effect.fn("CoffeeOrders.pickUpOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  InvalidOrderStatusTransitionError | OrderNotFoundError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "picked-up");
});

export const cancelOrder = Effect.fn("CoffeeOrders.cancelOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  InvalidOrderStatusTransitionError | OrderNotFoundError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "cancelled");
});
