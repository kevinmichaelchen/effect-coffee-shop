import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { OrderNotFoundError } from "@effect-coffee-shop/coffee-core/domain/errors";
import type { CoffeeOrder, OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  AuthenticationRequiredError,
  requireSignedInActor,
} from "@effect-coffee-shop/coffee-core/service/CurrentActor";
import {
  InternalAppError,
  internalAppErrorFromPersistence,
} from "@effect-coffee-shop/coffee-core/service/errors";
import {
  actorObservabilityAttributes,
  annotateObservabilitySpan,
  logInfoWithAttributes,
} from "@effect-coffee-shop/coffee-core/service/observability";
import { OrderRepository } from "../ports/OrderRepository.ts";

export const getOrder = Effect.fn("CoffeeOrders.getOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<
  CoffeeOrder,
  AuthenticationRequiredError | OrderNotFoundError | InternalAppError,
  OrderRepository
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
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new OrderNotFoundError({ orderId })),
        onSome: Effect.succeed,
      }),
    ),
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
