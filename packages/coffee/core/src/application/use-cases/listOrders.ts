/**
 * Lists Coffee orders visible to the current actor.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import { InvalidOrderInputError } from "@effect-coffee-shop/coffee-core/domain/errors";
import { isOrderStatus, type CoffeeOrders } from "@effect-coffee-shop/coffee-core/domain/order";
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
  recordOrderAction,
} from "@effect-coffee-shop/coffee-core/application/observability";
import { OrderRepository } from "../ports/OrderRepository.ts";
import { type ListOrdersRequest } from "../contracts.ts";

export const listOrders = Effect.fn("CoffeeOrders.listOrders")(function* (
  request: ListOrdersRequest,
): Effect.fn.Return<
  CoffeeOrders,
  AuthenticationRequiredError | InvalidOrderInputError | InternalAppError,
  CurrentActor | OrderRepository
> {
  const actor = yield* requireSignedInActor();
  const orderRepository = yield* OrderRepository;
  const ownerFilter = actor.kind === "customer" ? { ownerUserId: actor.userId } : {};
  const observabilityAttributes = {
    ...actorObservabilityAttributes(actor),
    order_action: "list",
    ...(request.status === undefined ? {} : { order_status: request.status }),
  };

  yield* annotateObservabilitySpan(observabilityAttributes);

  if (request.status === undefined) {
    const orders = yield* orderRepository
      .list(ownerFilter)
      .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to list orders right now")));

    yield* logInfoWithAttributes("listed coffee orders", {
      ...observabilityAttributes,
      order_count: orders.length,
    });
    yield* recordOrderAction({
      action: "list",
      actor,
      result: "success",
    });

    return orders;
  }

  if (!isOrderStatus(request.status)) {
    return yield* new InvalidOrderInputError({
      message: `status "${request.status}" is not supported`,
    });
  }

  const orders = yield* orderRepository
    .list({
      ...ownerFilter,
      status: request.status,
    })
    .pipe(Effect.mapError(internalAppErrorFromPersistence("Unable to list orders right now")));

  yield* logInfoWithAttributes("listed coffee orders", {
    ...observabilityAttributes,
    order_count: orders.length,
  });
  yield* recordOrderAction({
    action: "list",
    actor,
    result: "success",
    status: request.status,
  });

  return orders;
});
