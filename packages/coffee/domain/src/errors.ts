/**
 * Defines domain-level Coffee ordering error types.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { OrderId, OrderStatus } from "./order.ts";

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
