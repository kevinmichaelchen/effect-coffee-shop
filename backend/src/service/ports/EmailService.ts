import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import type { CoffeeOrder } from "#domain/order";
import type { EmailError } from "#service/errors";

export class EmailService extends Context.Service<
  EmailService,
  {
    readonly sendOrderConfirmation: (
      order: CoffeeOrder,
      recipientEmail: string,
    ) => Effect.Effect<void, EmailError>;
  }
>()("effect-coffee-shop/service/EmailService") {}
