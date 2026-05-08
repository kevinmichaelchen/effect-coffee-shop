import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";

export function serializeToolResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  return JSON.stringify(result);
}

export function formatToolPayload(payload: unknown): string {
  if (isEmptyObject(payload)) {
    return "No arguments.";
  }

  if (typeof payload === "string") {
    return payload;
  }

  return JSON.stringify(payload, null, 2) ?? "No structured detail.";
}

export function formatToolFailure(error: unknown): string {
  if (error instanceof InvalidOrderInputError || error instanceof InternalAppError) {
    return error.message;
  }

  if (error instanceof DrinkNotFoundError) {
    return `Drink ${error.drinkId} was not found.`;
  }

  if (error instanceof OrderNotFoundError) {
    return `Order ${error.orderId} was not found.`;
  }

  if (error instanceof InvalidOrderStatusTransitionError) {
    return `Order ${error.orderId} cannot move from ${error.from} to ${error.to}.`;
  }

  if (isErrorLike(error)) {
    return error.message;
  }

  return "Assistant tool execution failed.";
}

function isEmptyObject(value: unknown): boolean {
  return typeof value === "object" && value !== null && Object.keys(value).length === 0;
}

function isErrorLike(value: unknown): value is { readonly message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof value.message === "string"
  );
}
