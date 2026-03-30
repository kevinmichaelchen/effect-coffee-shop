import * as Schema from "effect/Schema"
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError
} from "../../domain/errors.ts"

export const AppErrorSchema = Schema.Union([
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError
]).annotate({ identifier: "AppError" })
