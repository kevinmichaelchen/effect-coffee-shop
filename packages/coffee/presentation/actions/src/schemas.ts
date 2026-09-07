/**
 * Defines action-layer input and error schemas shared by tool surfaces.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { OrderId } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  CartItemIdRequest,
  CheckoutCartRequest,
  ItemOptionsRequest,
  ListOrdersRequest,
  OrderItemInput,
  PlaceOrderRequest,
  QuoteOrderRequest,
  UpdateCartItemRequest,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";

export const AppError = Schema.Union([
  AuthenticationRequiredError,
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
  InternalAppError,
  StaffRoleRequiredError,
]).annotate({ identifier: "AppError" });

export const EmptyActionInput = Schema.Record(Schema.String, Schema.Never);

export const OrderIdActionInput = Schema.Struct({
  orderId: OrderId.annotate({
    description: "Coffee shop ticket id, such as order_00000000000000000000000001.",
  }),
});

// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeEmptyActionInput = Schema.decodeUnknownEffect(EmptyActionInput);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeOrderIdInput = Schema.decodeUnknownEffect(OrderIdActionInput);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeCartItemIdInput = Schema.decodeUnknownEffect(CartItemIdRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeCheckoutCartInput = Schema.decodeUnknownEffect(CheckoutCartRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeItemOptionsInput = Schema.decodeUnknownEffect(ItemOptionsRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeListOrdersInput = Schema.decodeUnknownEffect(ListOrdersRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeOrderItemInput = Schema.decodeUnknownEffect(OrderItemInput);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodePlaceOrderInput = Schema.decodeUnknownEffect(PlaceOrderRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeQuoteOrderInput = Schema.decodeUnknownEffect(QuoteOrderRequest);
// oxlint-disable-next-line effect/require-schema-type-alias -- Schema decoder functions have no .Type member.
export const decodeUpdateCartItemInput = Schema.decodeUnknownEffect(UpdateCartItemRequest);

export type AppError = typeof AppError.Type;

export type EmptyActionInput = typeof EmptyActionInput.Type;

export type OrderIdActionInput = typeof OrderIdActionInput.Type;
