/**
 * Defines action-layer input and error schemas shared by tool surfaces.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import {
  AuthenticationRequiredError,
  StaffRoleRequiredError,
} from "@effect-coffee-shop/coffee-application/CurrentActor";
import {
  DrinkNotFoundError,
  InternalAppError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-application/errors";

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
  orderId: OrderId,
});

export type AppError = typeof AppError.Type;

export type EmptyActionInput = typeof EmptyActionInput.Type;

export type OrderIdActionInput = typeof OrderIdActionInput.Type;
