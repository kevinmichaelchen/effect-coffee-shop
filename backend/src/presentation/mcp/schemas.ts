import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "#domain/errors";
import { AuthenticationRequiredError, StaffRoleRequiredError } from "#service/CurrentActor";
import { InternalAppError } from "#service/errors";

export const AppErrorSchema = Schema.Union([
  AuthenticationRequiredError,
  DrinkNotFoundError,
  InvalidOrderInputError,
  OrderNotFoundError,
  InvalidOrderStatusTransitionError,
  InternalAppError,
  StaffRoleRequiredError,
]).annotate({ identifier: "AppError" });
