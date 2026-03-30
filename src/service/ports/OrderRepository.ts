import type * as Effect from "effect/Effect";
import * as ServiceMap from "effect/ServiceMap";
import type { CoffeeOrder, ListOrdersFilters, OrderId } from "#domain/order";

export class OrderRepository extends ServiceMap.Service<
  OrderRepository,
  {
    readonly save: (order: CoffeeOrder) => Effect.Effect<CoffeeOrder>;
    readonly getById: (orderId: OrderId) => Effect.Effect<CoffeeOrder | undefined>;
    readonly list: (filters?: ListOrdersFilters) => Effect.Effect<ReadonlyArray<CoffeeOrder>>;
  }
>()("effect-v4-onion/service/OrderRepository") {}
