import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { CheckoutSessionId } from "../../domain/checkout-session.ts";

export class CheckoutSessionIdGenerator extends Context.Service<
  CheckoutSessionIdGenerator,
  {
    readonly next: Effect.Effect<CheckoutSessionId>;
  }
>()("effect-coffee-shop/application/CheckoutSessionIdGenerator") {}
