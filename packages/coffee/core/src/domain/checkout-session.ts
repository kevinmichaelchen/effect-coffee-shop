/**
 * Defines immutable checkout sessions created before cart confirmation.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { MoneySchema } from "./money.ts";
import { CoffeeOrderItemSchema } from "./order.ts";

const checkoutSessionIdPattern = /^checkout-session-\d+$/;

export const CheckoutSessionIdSchema = Schema.String.check(
  Schema.isPattern(checkoutSessionIdPattern),
)
  .pipe(Schema.brand("CheckoutSessionId"))
  .annotate({ identifier: "CheckoutSessionId" });
export type CheckoutSessionId = typeof CheckoutSessionIdSchema.Type;
export const checkoutSessionIdFromString = Schema.decodeUnknownSync(CheckoutSessionIdSchema);

export const checkoutSessionStatuses = ["awaiting_confirmation"] as const;
export type CheckoutSessionStatus = (typeof checkoutSessionStatuses)[number];
export const CheckoutSessionStatusSchema = Schema.Literals(checkoutSessionStatuses);

export const CheckoutSessionSchema = Schema.Struct({
  id: CheckoutSessionIdSchema,
  ownerUserId: Schema.String,
  status: CheckoutSessionStatusSchema,
  items: Schema.NonEmptyArray(CoffeeOrderItemSchema),
  totalPrice: MoneySchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CheckoutSession" });
export type CheckoutSession = typeof CheckoutSessionSchema.Type;
