/**
 * Defines immutable checkout sessions created before cart confirmation.
 *
 * @module
 */
import { makeTypeId, type TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";
import { Money } from "./money.ts";
import { CoffeeOrderItem } from "./order.ts";
import { typeId } from "./typed-id.ts";

export const CheckoutSessionIdFactory = makeTypeId("checkout_session", {
  brand: "CheckoutSessionId",
});
export type CheckoutSessionId = TypeIdFrom<typeof CheckoutSessionIdFactory>;
export const CheckoutSessionId = typeId(CheckoutSessionIdFactory).annotate({
  identifier: "CheckoutSessionId",
});
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const checkoutSessionIdFromString = Schema.decodeUnknownSync(CheckoutSessionId);

export const checkoutSessionStatuses = ["awaiting_confirmation"] as const;
export type CheckoutSessionStatus = (typeof checkoutSessionStatuses)[number];
export const CheckoutSessionStatus = Schema.Literals(checkoutSessionStatuses);

export const CheckoutSession = Schema.Struct({
  id: CheckoutSessionId,
  ownerUserId: Schema.String,
  status: CheckoutSessionStatus,
  items: Schema.NonEmptyArray(CoffeeOrderItem),
  totalPrice: Money,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
  expiresAt: Schema.DateTimeUtc,
}).annotate({ identifier: "CheckoutSession" });
export type CheckoutSession = typeof CheckoutSession.Type;
