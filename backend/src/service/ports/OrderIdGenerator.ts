import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { OrderId } from "#domain/order";

export class OrderIdGenerator extends Context.Service<
  OrderIdGenerator,
  {
    readonly next: Effect.Effect<OrderId>;
  }
>()("effect-coffee-shop/service/OrderIdGenerator") {}
