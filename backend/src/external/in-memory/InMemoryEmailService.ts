import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { EmailService } from "#service/ports/EmailService";

export const InMemoryEmailServiceLive = Layer.succeed(
  EmailService,
  EmailService.of({
    sendOrderConfirmation: (_order, _recipientEmail) => Effect.void,
  }),
);
