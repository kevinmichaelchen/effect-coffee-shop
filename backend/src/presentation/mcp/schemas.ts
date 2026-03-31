import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "#domain/errors";
import { InternalAppError } from "#service/errors";

export const AppErrorSchema = Schema.Union([
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
  InternalAppError,
]).annotate({ identifier: "AppError" });
