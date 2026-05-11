import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type { CheckoutSession, CheckoutSessionId } from "../../domain/checkout-session.ts";
import type { PersistenceError } from "../errors.ts";

export class CheckoutSessionRepository extends Context.Service<
  CheckoutSessionRepository,
  {
    readonly getById: (
      id: CheckoutSessionId,
    ) => Effect.Effect<Option.Option<CheckoutSession>, PersistenceError>;
    readonly getCurrentByOwnerUserId: (
      ownerUserId: string,
    ) => Effect.Effect<Option.Option<CheckoutSession>, PersistenceError>;
    readonly save: (session: CheckoutSession) => Effect.Effect<CheckoutSession, PersistenceError>;
    readonly clearCurrentByOwnerUserId: (
      ownerUserId: string,
    ) => Effect.Effect<void, PersistenceError>;
  }
>()("effect-coffee-shop/application/CheckoutSessionRepository") {}
