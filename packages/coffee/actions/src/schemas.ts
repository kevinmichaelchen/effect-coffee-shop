import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { OrderIdSchema } from "@effect-coffee-shop/coffee-core/domain/order";
import {
  ListOrdersRequestSchema,
  PlaceOrderRequestSchema,
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
export const decodeListOrdersInput = Schema.decodeUnknownPromise(ListOrdersRequestSchema);
export const decodePlaceOrderInput = Schema.decodeUnknownPromise(PlaceOrderRequestSchema);
