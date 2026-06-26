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
  orderId: OrderIdSchema.annotate({
    description: "Coffee shop ticket id, such as order_00000000000000000000000001.",
  }),
});

export const decodeEmptyActionInput = Schema.decodeUnknownEffect(EmptyActionInputSchema);
export const decodeOrderIdInput = Schema.decodeUnknownEffect(OrderIdActionInputSchema);
export const decodeCartItemIdInput = Schema.decodeUnknownEffect(CartItemIdRequestSchema);
export const decodeCheckoutCartInput = Schema.decodeUnknownEffect(CheckoutCartRequestSchema);
export const decodeItemOptionsInput = Schema.decodeUnknownEffect(ItemOptionsRequestSchema);
export const decodeListOrdersInput = Schema.decodeUnknownEffect(ListOrdersRequestSchema);
export const decodeOrderItemInput = Schema.decodeUnknownEffect(OrderItemInputSchema);
export const decodePlaceOrderInput = Schema.decodeUnknownEffect(PlaceOrderRequestSchema);
export const decodeQuoteOrderInput = Schema.decodeUnknownEffect(QuoteOrderRequestSchema);
export const decodeUpdateCartItemInput = Schema.decodeUnknownEffect(UpdateCartItemRequestSchema);
