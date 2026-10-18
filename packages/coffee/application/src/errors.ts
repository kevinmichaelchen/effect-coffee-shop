/**
 * Defines the errors Coffee adapters (HTTP, MCP) report, with their HTTP statuses.
 * Domain rejections are translated into these at the application boundary.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { OrderId } from "@effect-coffee-shop/coffee-domain/Order/Order.id";
import { OrderStatus } from "@effect-coffee-shop/coffee-domain/Order/OrderStatus";

export class InternalAppError extends Schema.TaggedError<InternalAppError>()(
  "InternalAppError",
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect()),
  },
  { httpApiStatus: 500 },
) {}

export class DrinkNotFoundError extends Schema.TaggedError<DrinkNotFoundError>()(
  "DrinkNotFoundError",
  {
    drinkId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class InvalidOrderInputError extends Schema.TaggedError<InvalidOrderInputError>()(
  "InvalidOrderInputError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class OrderNotFoundError extends Schema.TaggedError<OrderNotFoundError>()(
  "OrderNotFoundError",
  {
    orderId: OrderId,
  },
  { httpApiStatus: 404 },
) {}

export class InvalidOrderStatusTransitionError extends Schema.TaggedError<InvalidOrderStatusTransitionError>()(
  "InvalidOrderStatusTransitionError",
  {
    orderId: OrderId,
    from: OrderStatus,
    to: OrderStatus,
  },
  { httpApiStatus: 409 },
) {}
