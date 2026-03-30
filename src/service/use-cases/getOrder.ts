import * as Effect from "effect/Effect"
import { OrderNotFoundError } from "../../domain/errors.ts"
import type { CoffeeOrder, OrderId } from "../../domain/order.ts"
import { OrderRepository } from "../ports/OrderRepository.ts"

export const getOrder = Effect.fn("CoffeeOrders.getOrder")(
  function*(orderId: OrderId): Effect.fn.Return<CoffeeOrder, OrderNotFoundError, OrderRepository> {
    const orderRepository = yield* OrderRepository
    const order = yield* orderRepository.getById(orderId)

    if (order === undefined) {
      return yield* new OrderNotFoundError({ orderId })
    }

    return order
  }
)
