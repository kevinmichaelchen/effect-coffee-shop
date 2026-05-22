/**
 * Defines domain-level Coffee ordering error types.
 *
 * @module
 */
import * as Schema from "effect/Schema";
import { OrderIdSchema, OrderStatusSchema } from "./order.ts";

export class DrinkNotFoundError extends Schema.TaggedErrorClass<DrinkNotFoundError>()(
  "DrinkNotFoundError",
  {
    drinkId: Schema.String,
  },
  { httpApiStatus: 404 },
) {}

export class InvalidOrderInputError extends Schema.TaggedErrorClass<InvalidOrderInputError>()(
  "InvalidOrderInputError",
  {
    message: Schema.String,
  },
  { httpApiStatus: 400 },
) {}

export class OrderNotFoundError extends Schema.TaggedErrorClass<OrderNotFoundError>()(
  "OrderNotFoundError",
  {
    orderId: OrderIdSchema,
  },
  { httpApiStatus: 404 },
) {}

export class InvalidOrderStatusTransitionError extends Schema.TaggedErrorClass<InvalidOrderStatusTransitionError>()(
  "InvalidOrderStatusTransitionError",
  {
    orderId: OrderIdSchema,
    from: OrderStatusSchema,
    to: OrderStatusSchema,
  },
  { httpApiStatus: 409 },
) {}
