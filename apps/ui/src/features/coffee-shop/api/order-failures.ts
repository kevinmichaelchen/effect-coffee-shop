import * as Match from "effect/Match";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { getStatusLabel } from "#features/coffee-shop/lib/coffee.ts";
import type { CustomerClient, StaffClient } from "./domain-clients.ts";

/** What the order screens show when an Api call fails: one readable message. */
export class OrderRequestError extends Schema.TaggedError<
  OrderRequestError,
  { readonly brand: unique symbol }
>()("OrderRequestError", { message: Schema.String }) {}

export type FailureOf<Call> = Call extends (...args: never[]) => infer Result
  ? Effect.Error<Result>
  : never;

/**
 * Every failure the order calls report, as the Api clients type them: the
 * domain rejections, the session middleware's `Unauthorized`, and transport.
 */
export type OrderFailure =
  | FailureOf<CustomerClient["PlaceOrder"]>
  | FailureOf<CustomerClient["CustomerOrders"]["get"]>
  | FailureOf<StaffClient["OrderQueue"]["get"]>
  | FailureOf<StaffClient["StartBrewing" | "MarkReady" | "PickUpOrder" | "CancelOrder"]>;

const describeOrderFailure = Match.type<OrderFailure>().pipe(
  Match.tagsExhaustive({
    AlreadyPlaced: () => "This order was already placed.",
    DrinkNotFound: ({ drinkId }) => `"${drinkId}" is not on the menu.`,
    InvalidOrder: ({ message }) => message,
    InvalidStatusTransition: ({ from, to }) =>
      `An order that is ${getStatusLabel(from)} cannot move to ${getStatusLabel(to)}.`,
    NotYourOrder: () => "That order belongs to another customer.",
    OrderNotFound: ({ orderId }) => `Order ${orderId} was not found.`,
    StaffOnly: () => "Only coffee-shop staff can do that.",
    Unauthorized: () => "Sign in to place and view orders.",
    RpcClientError: () => "Unable to reach the coffee shop. Check your connection and try again.",
  }),
);

export function toOrderRequestError(failure: OrderFailure): OrderRequestError {
  return new OrderRequestError({ message: describeOrderFailure(failure) });
}
