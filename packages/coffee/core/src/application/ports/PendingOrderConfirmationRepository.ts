import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import * as Context from "effect/Context";
import type { PendingOrderConfirmation } from "../../domain/pending-order-confirmation.ts";
import type { PersistenceError } from "../errors.ts";

export class PendingOrderConfirmationRepository extends Context.Service<
  PendingOrderConfirmationRepository,
  {
    readonly getByOwnerUserId: (
      ownerUserId: string,
    ) => Effect.Effect<Option.Option<PendingOrderConfirmation>, PersistenceError>;
    readonly save: (
      confirmation: PendingOrderConfirmation,
    ) => Effect.Effect<PendingOrderConfirmation, PersistenceError>;
    readonly clear: (ownerUserId: string) => Effect.Effect<void, PersistenceError>;
  }
>()("effect-coffee-shop/application/PendingOrderConfirmationRepository") {}
