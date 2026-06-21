import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  executeCoffeeActionEffect,
  type CoffeeAppRunner,
} from "@effect-coffee-shop/coffee-actions/execute";
import { formatToolFailure } from "@effect-coffee-shop/coffee-actions/format";
import type { CoffeeActionName } from "@effect-coffee-shop/coffee-actions/specs";
import { agentActionInputFor, type AgentInputDecoder } from "./action-input.ts";

class AgentCapabilityExecutionError extends Schema.TaggedErrorClass<AgentCapabilityExecutionError>()(
  "AgentCapabilityExecutionError",
  {
    message: Schema.String,
  },
) {}

class AgentCapabilityInputError extends Schema.TaggedErrorClass<AgentCapabilityInputError>()(
  "AgentCapabilityInputError",
  {
    message: Schema.String,
  },
) {}

class UnsupportedAgentCapabilityError extends Schema.TaggedErrorClass<UnsupportedAgentCapabilityError>()(
  "UnsupportedAgentCapabilityError",
  {
    capability: Schema.String,
  },
) {}

function toExecutionError(error: unknown): AgentCapabilityExecutionError {
  return new AgentCapabilityExecutionError({
    message: formatToolFailure(error),
  });
}

function decodeAgentInput<A>(input: {
  readonly decode: AgentInputDecoder<A>;
  readonly failureMessage: string;
  readonly value: unknown;
}): Effect.Effect<A, AgentCapabilityInputError> {
  return input.decode(input.value).pipe(
    Effect.mapError(
      () =>
        new AgentCapabilityInputError({
          message: input.failureMessage,
        }),
    ),
  );
}

function runAgentAction<A>(input: {
  readonly action: CoffeeActionName;
  readonly decode: AgentInputDecoder<A>;
  readonly failureMessage: string;
  readonly arguments: unknown;
  readonly runApp: CoffeeAppRunner;
}): Effect.Effect<unknown, AgentCapabilityExecutionError | AgentCapabilityInputError> {
  const payload = input.arguments ?? {};

  return decodeAgentInput({
    decode: input.decode,
    failureMessage: input.failureMessage,
    value: payload,
  }).pipe(
    Effect.flatMap(() =>
      executeCoffeeActionEffect({
        action: input.action,
        payload,
        runApp: input.runApp,
      }).pipe(Effect.mapError(toExecutionError)),
    ),
  );
}

export function executeCoffeeAgentCapabilityEffect(input: {
  readonly arguments: unknown;
  readonly capability: string;
  readonly runApp: CoffeeAppRunner;
}): Effect.Effect<
  unknown,
  AgentCapabilityExecutionError | AgentCapabilityInputError | UnsupportedAgentCapabilityError
> {
  return Option.match(agentActionInputFor(input.capability), {
    onNone: (): Effect.Effect<
      unknown,
      AgentCapabilityExecutionError | AgentCapabilityInputError | UnsupportedAgentCapabilityError
    > =>
      Effect.fail(
        new UnsupportedAgentCapabilityError({
          capability: input.capability,
        }),
      ),
    onSome: (
      actionInput,
    ): Effect.Effect<
      unknown,
      AgentCapabilityExecutionError | AgentCapabilityInputError | UnsupportedAgentCapabilityError
    > =>
      runAgentAction({
        ...actionInput,
        arguments: input.arguments,
        runApp: input.runApp,
      }),
  });
}
