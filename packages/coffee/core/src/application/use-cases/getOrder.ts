/**
 * Fetches one Coffee order with actor-level access control.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { OrderNotFoundError } from "@effect-coffee-shop/coffee-core/domain/errors";
import type { CoffeeOrder, OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  AuthenticationRequiredError,
  CurrentActor,
  requireSignedInActor,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/application/errors";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
} from "@effect-coffee-shop/coffee-core/application/observability";
import { OrderRepository } from "../ports/OrderRepository.ts";

export const getOrder = Effect.fn("CoffeeOrders.getOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | OrderNotFoundError | InternalAppError,
  CurrentActor | OrderRepository
> {
  const actor = yield* requireSignedInActor();
  const orderRepository = yield* OrderRepository;
  const observabilityAttributes = {
    ...actorObservabilityAttributes(actor),
    order_action: "get",
    order_id: orderId,
  };

  yield* annotateObservabilitySpan(observabilityAttributes);

  const order = yield* orderRepository.getById(orderId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load order right now")),
    Effect.flatMap((order) => Effect.fromOption(order, () => new OrderNotFoundError({ orderId }))),
  );

  if (actor.kind === "customer" && order.ownerUserId !== actor.userId) {
    return yield* new OrderNotFoundError({ orderId });
  }

  yield* logInfoWithAttributes("loaded coffee order", {
    ...observabilityAttributes,
    order_status: order.status,
  });

  return order;
});
