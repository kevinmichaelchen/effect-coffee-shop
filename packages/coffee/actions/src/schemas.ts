import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
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
