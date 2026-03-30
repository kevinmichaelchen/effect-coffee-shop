import type * as Effect from "effect/Effect";
import * as ServiceMap from "effect/ServiceMap";
import type { OrderId } from "#domain/order";

export class OrderIdGenerator extends ServiceMap.Service<
  OrderIdGenerator,
  {
    readonly next: Effect.Effect<OrderId>;
  }
>()("effect-v4-onion/service/OrderIdGenerator") {}
