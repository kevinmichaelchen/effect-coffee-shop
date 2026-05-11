import * as Schema from "effect/Schema";
import { MoneySchema } from "./money.ts";
import { CoffeeOrderItemSchema } from "./order.ts";

export const pendingOrderConfirmationStatus = "pending_confirmation" as const;

export const PendingOrderConfirmationSourceSchema = Schema.Literals(["direct-order", "cart"]);
export type PendingOrderConfirmationSource = typeof PendingOrderConfirmationSourceSchema.Type;

export const PendingOrderConfirmationIdSchema = Schema.String.check(Schema.isUUID(4))
  .pipe(Schema.brand("PendingOrderConfirmationId"))
  .annotate({
    identifier: "PendingOrderConfirmationId",
  });
export type PendingOrderConfirmationId = typeof PendingOrderConfirmationIdSchema.Type;
export const pendingOrderConfirmationIdFromString = Schema.decodeUnknownSync(
  PendingOrderConfirmationIdSchema,
);

export const PendingOrderConfirmationSchema = Schema.Struct({
  confirmationId: PendingOrderConfirmationIdSchema,
  ownerUserId: Schema.String,
  source: PendingOrderConfirmationSourceSchema,
  status: Schema.Literal(pendingOrderConfirmationStatus),
  items: Schema.NonEmptyArray(CoffeeOrderItemSchema),
  totalPrice: MoneySchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "PendingOrderConfirmation" });
export type PendingOrderConfirmation = typeof PendingOrderConfirmationSchema.Type;
