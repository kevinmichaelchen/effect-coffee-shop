/**
 * Defines the errors Coffee adapters (HTTP, MCP) report, with their HTTP statuses.
 * Domain rejections are translated into these at the application boundary.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";

export class InternalAppError extends Schema.TaggedError<
  InternalAppError,
  { readonly brand: unique symbol }
>()(
  "InternalAppError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 500 },
) {}

export class DrinkNotFoundError extends Schema.TaggedError<
  DrinkNotFoundError,
  { readonly brand: unique symbol }
>()(
  "DrinkNotFoundError",
  {
    drinkId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class InvalidOrderInputError extends Schema.TaggedError<
  InvalidOrderInputError,
  { readonly brand: unique symbol }
>()(
  "InvalidOrderInputError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class OrderNotFoundError extends Schema.TaggedError<
  OrderNotFoundError,
  { readonly brand: unique symbol }
>()(
  "OrderNotFoundError",
  {
    orderId: OrderId,
  },
  { httpApiStatus: 404 },
) {}
