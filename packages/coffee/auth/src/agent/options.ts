import type { AgentAuthOptions, AgentSession } from "@better-auth/agent-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  executeCoffeeActionEffect,
  type CoffeeAppRunner,
} from "@effect-coffee-shop/coffee-actions/execute";
import type { CoffeeActionName } from "@effect-coffee-shop/coffee-actions/specs";
import { emptyWebHandlerServices } from "@effect-coffee-shop/http-routing/request-services";
import { coffeeAgentCapabilities } from "./capabilities.ts";
import { formatToolFailure } from "@effect-coffee-shop/coffee-actions/format";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { CurrentActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { agentActionInputFor, type AgentInputDecoder } from "./action-input.ts";

const toAgentActor = (session: AgentSession) => ({
  displayName: session.user.name.trim() || session.user.email,
  kind: "customer" as const,
  userId: session.user.id,
});

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

export function createCoffeeAgentAppRunner(input: {
  readonly appLayer: Layer.Layer<never, any, any>;
  readonly session: AgentSession;
}): CoffeeAppRunner {
  const liveLayer = CoffeeOrderApp.layer.pipe(Layer.provide(input.appLayer));
  const services = emptyWebHandlerServices().pipe(
    Context.add(CurrentActor, toAgentActor(input.session)),
  );

  return <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) =>
    effect.pipe(Effect.provide(liveLayer), Effect.provide(services));
}

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

export function createCoffeeAgentAuthOptions(input: {
  readonly appLayer: Layer.Layer<never, any, any>;
}): Pick<
  AgentAuthOptions,
  | "approvalMethods"
  | "capabilities"
  | "deviceAuthorizationPage"
  | "modes"
  | "onExecute"
  | "providerDescription"
  | "providerName"
> {
  return {
    approvalMethods: ["device_authorization"],
    capabilities: [...coffeeAgentCapabilities],
    deviceAuthorizationPage: "/device/capabilities",
    modes: ["delegated"],
    onExecute: async ({ agentSession, arguments: args, capability }) => {
      const runApp = createCoffeeAgentAppRunner({
        appLayer: input.appLayer,
        session: agentSession,
      });

      return Effect.runPromise(
        executeCoffeeAgentCapabilityEffect({
          arguments: args,
          capability,
          runApp,
        }),
      );
    },
    providerDescription:
      "Coffee ordering capabilities for delegated AI agents acting on behalf of a signed-in customer.",
    providerName: "Effect Coffee Shop",
  };
}
