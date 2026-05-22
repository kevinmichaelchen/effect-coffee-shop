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
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  CartItemIdRequestSchema,
  CheckoutCartRequestSchema,
  ItemOptionsRequestSchema,
  ListOrdersRequestSchema,
  OrderItemInputSchema,
  PlaceOrderRequestSchema,
  QuoteOrderRequestSchema,
  UpdateCartItemRequestSchema,
} from "@effect-coffee-shop/coffee-core/application/contracts";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
} from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";

export const AppErrorSchema = Schema.Union([
  AuthenticationRequiredError,
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
  InternalAppError,
  StaffRoleRequiredError,
]).annotate({ identifier: "AppError" });

export const EmptyActionInputSchema = Schema.Struct({});

export const OrderIdActionInputSchema = Schema.Struct({
  orderId: OrderIdSchema,
});

export const decodeEmptyActionInput = Schema.decodeUnknownPromise(EmptyActionInputSchema);
export const decodeOrderIdInput = Schema.decodeUnknownPromise(OrderIdActionInputSchema);
export const decodeCartItemIdInput = Schema.decodeUnknownPromise(CartItemIdRequestSchema);
export const decodeCheckoutCartInput = Schema.decodeUnknownPromise(CheckoutCartRequestSchema);
export const decodeItemOptionsInput = Schema.decodeUnknownPromise(ItemOptionsRequestSchema);
export const decodeListOrdersInput = Schema.decodeUnknownPromise(ListOrdersRequestSchema);
export const decodeOrderItemInput = Schema.decodeUnknownPromise(OrderItemInputSchema);
export const decodePlaceOrderInput = Schema.decodeUnknownPromise(PlaceOrderRequestSchema);
export const decodeQuoteOrderInput = Schema.decodeUnknownPromise(QuoteOrderRequestSchema);
export const decodeUpdateCartItemInput = Schema.decodeUnknownPromise(UpdateCartItemRequestSchema);
