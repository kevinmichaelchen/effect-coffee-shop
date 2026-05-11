import * as Schema from "effect/Schema";
import { MoneySchema } from "./money.ts";
import { CoffeeOrderItemSchema } from "./order.ts";

export const pendingOrderConfirmationStatus = "pending_confirmation" as const;

export const PendingOrderConfirmationSourceSchema = Schema.Literals(["direct-order", "cart"]);
export type PendingOrderConfirmationSource = typeof PendingOrderConfirmationSourceSchema.Type;

export const PendingOrderConfirmationSchema = Schema.Struct({
  ownerUserId: Schema.String,
  source: PendingOrderConfirmationSourceSchema,
  status: Schema.Literal(pendingOrderConfirmationStatus),
  items: Schema.NonEmptyArray(CoffeeOrderItemSchema),
  totalPrice: MoneySchema,
  updatedAt: Schema.DateTimeUtc,
}).annotate({ identifier: "PendingOrderConfirmation" });
export type PendingOrderConfirmation = typeof PendingOrderConfirmationSchema.Type;
