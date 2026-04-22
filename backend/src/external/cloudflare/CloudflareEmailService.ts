import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { EmailService } from "#service/ports/EmailService";
import { EmailError } from "#service/errors";

export interface SendEmailBinding {
  send(message: {
    readonly to: string | readonly string[];
    readonly from: string | { readonly email: string; readonly name: string };
    readonly subject: string;
    readonly html?: string;
    readonly text?: string;
  }): Promise<{ readonly messageId: string }>;
}

export const CloudflareEmailServiceLive = (email: SendEmailBinding) =>
  Layer.succeed(
    EmailService,
    EmailService.of({
      sendOrderConfirmation: (order, recipientEmail) =>
        Effect.tryPromise({
          try: async () =>
            await email.send({
              to: recipientEmail,
              from: { email: "noreply@effect-coffee.shop", name: "Effect Coffee Shop" },
              subject: `Order confirmation: ${order.id}`,
              text: `Hi ${order.customerName}, your ${order.drinkName} (${order.size}) is confirmed. Order ID: ${order.id}.`,
              html: `<p>Hi ${order.customerName},</p><p>Your <strong>${order.drinkName}</strong> (${order.size}) is confirmed.</p><p>Order ID: <code>${order.id}</code></p>`,
            }),
          catch: (cause) =>
            new EmailError({
              message: `Failed to send email: ${cause instanceof Error ? cause.message : String(cause)}`,
            }),
        }).pipe(Effect.asVoid),
    }),
  );
