import type { CancelOrder } from "@effect-coffee-shop/coffee-domain/Order/CancelOrder.command";
import type { MarkReady } from "@effect-coffee-shop/coffee-domain/Order/MarkReady.command";
import type { PickUpOrder } from "@effect-coffee-shop/coffee-domain/Order/PickUpOrder.command";
import type { PlaceOrder } from "@effect-coffee-shop/coffee-domain/Order/PlaceOrder.command";
import type { StartBrewing } from "@effect-coffee-shop/coffee-domain/Order/StartBrewing.command";
import type { Failure } from "@alchemy.run/domain/Foldkit";
import * as Match from "effect/Match";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";

/**
 * How an order command answers when it does not succeed, as the Foldkit
 * adapter reports it: the domain's refusal, the session's `Unauthorized`, or
 * an outcome the client never learned.
 */
export type OrderFailure = Failure<
  | typeof PlaceOrder
  | typeof StartBrewing
  | typeof MarkReady
  | typeof PickUpOrder
  | typeof CancelOrder
>;

/** Every reason those commands refuse to run, with its fields intact. */
type OrderRejection = Extract<OrderFailure, { readonly _tag: "Rejected" }>["rejection"];

/** What a Command shows when no reply established an outcome. */
export const unreachableMessage =
  "Unable to reach the coffee shop. Check your connection and try again.";

const describeRejection = Match.type<OrderRejection>().pipe(
  Match.tagsExhaustive({
    AlreadyPlaced: () => "This order was already placed.",
    DrinkNotFound: ({ drinkId }) => `"${drinkId}" is not on the menu.`,
    InvalidOrder: ({ message }) => message,
    InvalidStatusTransition: ({ from, to }) =>
      `An order that is ${getStatusLabel(from)} cannot move to ${getStatusLabel(to)}.`,
    OrderNotFound: ({ orderId }) => `Order ${orderId} was not found.`,
    StaffOnly: () => "Only coffee-shop staff can do that.",
  }),
);

/** What the order screens show when a command fails: one readable message. */
export const describeOrderFailure = (failure: OrderFailure): string =>
  Match.value(failure).pipe(
    Match.tagsExhaustive({
      Rejected: ({ rejection }) => describeRejection(rejection),
      Denied: () => "Sign in to place and view orders.",
      Unknown: () => unreachableMessage,
    }),
  );

/**
 * A refusal is final, so the next attempt gets a new command id. An unknown
 * outcome may have committed, so its retry keeps the original one.
 */
export const isRetryable = (failure: OrderFailure): boolean => failure._tag === "Unknown";
