import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as ServiceMap from "effect/ServiceMap";
import type { CoffeeOrder, ListOrdersFilters, OrderId } from "#domain/order";

export class OrderRepository extends ServiceMap.Service<
  OrderRepository,
  {
    readonly save: (order: CoffeeOrder) => Effect.Effect<CoffeeOrder>;
    readonly getById: (orderId: OrderId) => Effect.Effect<Option.Option<CoffeeOrder>>;
    readonly list: (filters?: ListOrdersFilters) => Effect.Effect<ReadonlyArray<CoffeeOrder>>;
  }
>()("effect-v4-onion/service/OrderRepository") {}
