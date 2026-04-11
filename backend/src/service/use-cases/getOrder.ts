import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { OrderNotFoundError } from "#domain/errors";
import type { CoffeeOrder, OrderId } from "#domain/order";
import { AuthenticationRequiredError, requireSignedInActor } from "#service/CurrentActor";
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
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

  return order;
});
