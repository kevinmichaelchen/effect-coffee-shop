import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type { CoffeeOrder, ListOrdersFilters } from "../../domain/order.ts"
import { OrderRepository } from "../../service/ports/OrderRepository.ts"

export const InMemoryOrderRepositoryLive = Layer.effect(
  OrderRepository,
  Effect.gen(function*() {
    const orders = new Map<string, CoffeeOrder>()
    let currentId = 0

    return OrderRepository.of({
      nextId: Effect.sync(() => {
        currentId += 1
        return `order-${String(currentId).padStart(4, "0")}`
      }),
      save: Effect.fn("InMemoryOrderRepository.save")(function*(order: CoffeeOrder) {
        orders.set(order.id, order)
        return order
      }),
      getById: Effect.fn("InMemoryOrderRepository.getById")(function*(orderId: string) {
        return orders.get(orderId)
      }),
      list: Effect.fn("InMemoryOrderRepository.list")(function*(filters: ListOrdersFilters = {}) {
        const values = Array.from(orders.values())
          .filter((order) => filters.status === undefined || order.status === filters.status)
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
        return values
      })
    })
  })
)
