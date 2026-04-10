import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { InvalidOrderStatusTransitionError, OrderNotFoundError } from "#domain/errors";
import { canTransitionTo, type CoffeeOrder, type OrderId, type OrderStatus } from "#domain/order";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
  requireStaffActor,
} from "#service/CurrentActor";
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
} from "#service/observability";
import { OrderRepository } from "../ports/OrderRepository.ts";

const updateOrderStatus = Effect.fn("CoffeeOrders.updateOrderStatus")(function* (
  orderId: OrderId,
  to: OrderStatus,
): Effect.fn.Return<
  CoffeeOrder,
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError,
  OrderRepository
> {
  const actor = yield* requireStaffActor();
  const orderRepository = yield* OrderRepository;
  const observabilityAttributes = {
    ...actorObservabilityAttributes(actor),
    next_order_status: to,
    order_action: "change-status",
    order_id: orderId,
  };

  yield* annotateObservabilitySpan(observabilityAttributes);

  const order = yield* orderRepository.getById(orderId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to update order status right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new OrderNotFoundError({ orderId })),
        onSome: Effect.succeed,
      }),
    ),
  );

  if (!canTransitionTo(order.status, to)) {
    return yield* new InvalidOrderStatusTransitionError({
      orderId,
      from: order.status,
      to,
    });
  }

  const updatedOrder = yield* orderRepository
    .save({
      ...order,
      status: to,
    })
    .pipe(
      Effect.mapError(internalAppErrorFromPersistence("Unable to update order status right now")),
    );

  yield* logInfoWithAttributes("updated coffee order status", {
    ...observabilityAttributes,
    order_status: updatedOrder.status,
    previous_order_status: order.status,
  });

  return updatedOrder;
});

export const startBrewing = Effect.fn("CoffeeOrders.startBrewing")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "brewing");
});

export const markReady = Effect.fn("CoffeeOrders.markReady")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "ready");
});

export const pickUpOrder = Effect.fn("CoffeeOrders.pickUpOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "picked-up");
});

export const cancelOrder = Effect.fn("CoffeeOrders.cancelOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError,
  OrderRepository
> {
  return yield* updateOrderStatus(orderId, "cancelled");
});
