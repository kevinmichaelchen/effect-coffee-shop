import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { OrderNotFoundError } from "#domain/errors";
import type { CoffeeOrder, OrderId } from "#domain/order";
import { InternalAppError, internalAppErrorFromPersistence } from "#service/errors";
import { OrderRepository } from "../ports/OrderRepository.ts";

export const getOrder = Effect.fn("CoffeeOrders.getOrder")(function* (
  orderId: OrderId,
): Effect.fn.Return<CoffeeOrder, OrderNotFoundError | InternalAppError, OrderRepository> {
  const orderRepository = yield* OrderRepository;
  return yield* orderRepository.getById(orderId).pipe(
    Effect.mapError(internalAppErrorFromPersistence("Unable to load order right now")),
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new OrderNotFoundError({ orderId })),
        onSome: Effect.succeed,
      }),
    ),
  );
});
