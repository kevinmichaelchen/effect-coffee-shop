import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import {
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import {
  canTransitionTo,
  type CoffeeOrder,
  type OrderId,
  type OrderStatus,
} from "@effect-coffee-shop/coffee-core/domain/order";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
  requireStaffActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/application/errors";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
  recordOrderAction,
} from "@effect-coffee-shop/coffee-core/application/observability";
import { OrderRepository } from "../ports/OrderRepository.ts";

type UpdateOrderStatusError =
  | AuthenticationRequiredError
  | InvalidOrderStatusTransitionError
  | OrderNotFoundError
  | StaffRoleRequiredError
  | InternalAppError;

const updateOrderStatus = Effect.fn("CoffeeOrders.updateOrderStatus")(function* (
  orderId: OrderId,
  to: OrderStatus,
): Effect.fn.Return<CoffeeOrder, UpdateOrderStatusError, OrderRepository> {
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
  yield* recordOrderAction({
    action: "change-status",
    actor,
    result: "success",
    status: updatedOrder.status,
  });

  return updatedOrder;
});

const makeOrderStatusUpdater = (name: string, status: OrderStatus) =>
  Effect.fn(name)(function* (
    orderId: OrderId,
  ): Effect.fn.Return<CoffeeOrder, UpdateOrderStatusError, OrderRepository> {
    return yield* updateOrderStatus(orderId, status);
  });

export const startBrewing = makeOrderStatusUpdater("CoffeeOrders.startBrewing", "brewing");
export const markReady = makeOrderStatusUpdater("CoffeeOrders.markReady", "ready");
export const pickUpOrder = makeOrderStatusUpdater("CoffeeOrders.pickUpOrder", "picked-up");
export const cancelOrder = makeOrderStatusUpdater("CoffeeOrders.cancelOrder", "cancelled");
