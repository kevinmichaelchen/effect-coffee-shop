import type { AgentAuthOptions, AgentSession } from "@better-auth/agent-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import {
  decodeCartItemIdInput,
  decodeCheckoutCartInput,
  decodeEmptyActionInput,
  decodeItemOptionsInput,
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodeOrderItemInput,
  decodePlaceOrderInput,
  decodeQuoteOrderInput,
  decodeUpdateCartItemInput,
} from "@effect-coffee-shop/coffee-actions/schemas";
import { executeCoffeeAction } from "@effect-coffee-shop/coffee-actions/execute";
import type { CoffeeActionName } from "@effect-coffee-shop/coffee-actions/specs";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { coffeeAgentCapabilities } from "./capabilities.ts";
import { formatToolFailure } from "@effect-coffee-shop/coffee-actions/format";
import { CoffeeOrderApp } from "@effect-coffee-shop/coffee-core/application/CoffeeOrderApp";
import { CurrentActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;
type AgentInputDecoder<A> = (value: unknown) => Effect.Effect<A, unknown>;

interface AgentActionInput {
  readonly action: CoffeeActionName;
  readonly decode: AgentInputDecoder<unknown>;
  readonly failureMessage: string;
}

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

  return async <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) =>
    Effect.runPromiseWith(services)(effect.pipe(Effect.provide(liveLayer)));
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
      Effect.tryPromise({
        try: () =>
          executeCoffeeAction({
            action: input.action,
            payload,
            runApp: input.runApp,
          }),
        catch: toExecutionError,
      }),
    ),
  );
}

const agentActionInput = (
  action: CoffeeActionName,
  decode: AgentInputDecoder<unknown>,
): AgentActionInput => ({
  action,
  decode,
  failureMessage: `Invalid ${action} arguments.`,
});

const agentActionInputFor = (capability: string): Option.Option<AgentActionInput> =>
  Match.value(capability).pipe(
    Match.when("list_menu", () =>
      Option.some(agentActionInput("list_menu", decodeEmptyActionInput)),
    ),
    Match.when("get_item_options", () =>
      Option.some(agentActionInput("get_item_options", decodeItemOptionsInput)),
    ),
    Match.when("validate_order", () =>
      Option.some(agentActionInput("validate_order", decodeQuoteOrderInput)),
    ),
    Match.when("quote_order", () =>
      Option.some(agentActionInput("quote_order", decodeQuoteOrderInput)),
    ),
    Match.when("place_order", () =>
      Option.some(agentActionInput("place_order", decodePlaceOrderInput)),
    ),
    Match.when("get_order", () => Option.some(agentActionInput("get_order", decodeOrderIdInput))),
    Match.when("list_orders", () =>
      Option.some(agentActionInput("list_orders", decodeListOrdersInput)),
    ),
    Match.when("get_cart", () => Option.some(agentActionInput("get_cart", decodeEmptyActionInput))),
    Match.when("add_cart_item", () =>
      Option.some(agentActionInput("add_cart_item", decodeOrderItemInput)),
    ),
    Match.when("update_cart_item", () =>
      Option.some(agentActionInput("update_cart_item", decodeUpdateCartItemInput)),
    ),
    Match.when("remove_cart_item", () =>
      Option.some(agentActionInput("remove_cart_item", decodeCartItemIdInput)),
    ),
    Match.when("clear_cart", () =>
      Option.some(agentActionInput("clear_cart", decodeEmptyActionInput)),
    ),
    Match.when("prepare_cart_checkout", () =>
      Option.some(agentActionInput("prepare_cart_checkout", decodeEmptyActionInput)),
    ),
    Match.when("get_checkout_session", () =>
      Option.some(agentActionInput("get_checkout_session", decodeEmptyActionInput)),
    ),
    Match.when("checkout_cart", () =>
      Option.some(agentActionInput("checkout_cart", decodeCheckoutCartInput)),
    ),
    Match.orElse(() => Option.none()),
  );

export async function executeCoffeeAgentCapability(input: {
  readonly arguments: unknown;
  readonly capability: string;
  readonly runApp: CoffeeAppRunner;
}): Promise<unknown> {
  return Effect.runPromise(
    Option.match(agentActionInputFor(input.capability), {
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
    }),
  );
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

      return executeCoffeeAgentCapability({
        arguments: args,
        capability,
        runApp,
      });
    },
    providerDescription:
      "Coffee ordering capabilities for delegated AI agents acting on behalf of a signed-in customer.",
    providerName: "Effect Coffee Shop",
  };
}
