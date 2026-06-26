/**
 * Defines immutable checkout sessions created before cart confirmation.
 *
 * @module
 */
import { makeTypeId, type TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";
import { MoneySchema } from "./money.ts";
import { CoffeeOrderItemSchema } from "./order.ts";
import { makeTypeIdSchema } from "./typed-id.ts";

export const CheckoutSessionIdFactory = makeTypeId("checkout_session", {
  brand: "CheckoutSessionId",
});
export type CheckoutSessionId = TypeIdFrom<typeof CheckoutSessionIdFactory>;
export const CheckoutSessionIdSchema = makeTypeIdSchema(CheckoutSessionIdFactory).annotate({
  identifier: "CheckoutSessionId",
});
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
