import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  DrinkNotFoundError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
} from "@effect-coffee-shop/coffee-core/domain/errors";
import { InternalAppError } from "@effect-coffee-shop/coffee-core/application/errors";

const KnownToolFailureSchema = Schema.Union([
  DrinkNotFoundError,
  InternalAppError,
  InvalidOrderInputError,
  InvalidOrderStatusTransitionError,
  OrderNotFoundError,
]);
const MessageOnlyFailureSchema = Schema.Struct({
  message: Schema.String,
});

type KnownToolFailure = typeof KnownToolFailureSchema.Type;

const decodeKnownToolFailure = Schema.decodeUnknownOption(KnownToolFailureSchema);
const decodeMessageOnlyFailure = Schema.decodeUnknownOption(MessageOnlyFailureSchema);

const formatKnownToolFailure = (error: KnownToolFailure): string =>
  Match.value(error).pipe(
    Match.tag("DrinkNotFoundError", (failure) => `Drink ${failure.drinkId} was not found.`),
    Match.tag("InternalAppError", (failure) => failure.message),
    Match.tag("InvalidOrderInputError", (failure) => failure.message),
    Match.tag(
      "InvalidOrderStatusTransitionError",
      (failure) => `Order ${failure.orderId} cannot move from ${failure.from} to ${failure.to}.`,
    ),
    Match.tag("OrderNotFoundError", (failure) => `Order ${failure.orderId} was not found.`),
    Match.exhaustive,
  );

export const formatToolFailure = (error: unknown): string =>
  Option.match(decodeKnownToolFailure(error), {
    onNone: () =>
      Option.match(decodeMessageOnlyFailure(error), {
        onNone: () => "Assistant tool execution failed.",
        onSome: (failure) => failure.message,
      }),
    onSome: formatKnownToolFailure,
  });
