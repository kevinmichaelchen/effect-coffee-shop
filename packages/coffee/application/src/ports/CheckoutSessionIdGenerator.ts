import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { CheckoutSessionId } from "@effect-coffee-shop/coffee-domain/checkout-session";

export class CheckoutSessionIdGenerator extends Context.Service<
  CheckoutSessionIdGenerator,
  {
    readonly next: Effect.Effect<CheckoutSessionId>;
  }
>()("effect-coffee-shop/application/CheckoutSessionIdGenerator") {}
