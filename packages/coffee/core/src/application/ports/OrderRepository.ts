import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type {
  CoffeeOrder,
  ListOrdersFilters,
  OrderId,
} from "@effect-coffee-shop/coffee-core/domain/order";
import type { PersistenceError } from "@effect-coffee-shop/coffee-core/application/errors";

export class OrderRepository extends Context.Service<
  OrderRepository,
  {
    readonly save: (order: CoffeeOrder) => Effect.Effect<CoffeeOrder, PersistenceError>;
    readonly getById: (
      orderId: OrderId,
    ) => Effect.Effect<Option.Option<CoffeeOrder>, PersistenceError>;
    readonly list: (
      filters?: ListOrdersFilters,
    ) => Effect.Effect<ReadonlyArray<CoffeeOrder>, PersistenceError>;
  }
>()("effect-coffee-shop/application/OrderRepository") {}
