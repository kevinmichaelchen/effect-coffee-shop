import type { AgentAuthOptions, AgentSession } from "@better-auth/agent-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
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

async function decodeAgentInput<A>(input: {
  readonly decode: (value: unknown) => Promise<A>;
  readonly failureMessage: string;
  readonly value: unknown;
}): Promise<A> {
  const result = await input
    .decode(input.value)
    .then((value) => ({ success: true as const, value }))
    .catch(() => ({ success: false as const }));

  if (!result.success) {
    return Promise.reject(
      new AgentCapabilityInputError({
        message: input.failureMessage,
      }),
    );
  }

  return result.value;
}

async function runAgentAction<A>(input: {
  readonly action: CoffeeActionName;
  readonly decode: (value: unknown) => Promise<A>;
  readonly failureMessage: string;
  readonly arguments: unknown;
  readonly runApp: CoffeeAppRunner;
}) {
  const payload = input.arguments ?? {};

  await decodeAgentInput({
    decode: input.decode,
    failureMessage: input.failureMessage,
    value: payload,
  });

  return executeCoffeeAction({
    action: input.action,
    payload,
    runApp: input.runApp,
  }).catch((error) => Promise.reject(toExecutionError(error)));
}

export async function executeCoffeeAgentCapability(input: {
  readonly arguments: unknown;
  readonly capability: string;
  readonly runApp: CoffeeAppRunner;
}) {
  switch (input.capability) {
    case "list_menu":
      return runAgentAction({
        action: "list_menu",
        arguments: input.arguments,
        decode: decodeEmptyActionInput,
        failureMessage: "Invalid list_menu arguments.",
        runApp: input.runApp,
      });
    case "get_item_options":
      return runAgentAction({
        action: "get_item_options",
        arguments: input.arguments,
        decode: decodeItemOptionsInput,
        failureMessage: "Invalid get_item_options arguments.",
        runApp: input.runApp,
      });
    case "validate_order":
      return runAgentAction({
        action: "validate_order",
        arguments: input.arguments,
        decode: decodeQuoteOrderInput,
        failureMessage: "Invalid validate_order arguments.",
        runApp: input.runApp,
      });
    case "quote_order":
      return runAgentAction({
        action: "quote_order",
        arguments: input.arguments,
        decode: decodeQuoteOrderInput,
        failureMessage: "Invalid quote_order arguments.",
        runApp: input.runApp,
      });
    case "place_order": {
      return runAgentAction({
        action: "place_order",
        arguments: input.arguments,
        decode: decodePlaceOrderInput,
        failureMessage: "Invalid place_order arguments.",
        runApp: input.runApp,
      });
    }
    case "get_order": {
      return runAgentAction({
        action: "get_order",
        arguments: input.arguments,
        decode: decodeOrderIdInput,
        failureMessage: "Invalid get_order arguments.",
        runApp: input.runApp,
      });
    }
    case "list_orders": {
      return runAgentAction({
        action: "list_orders",
        arguments: input.arguments,
        decode: decodeListOrdersInput,
        failureMessage: "Invalid list_orders arguments.",
        runApp: input.runApp,
      });
    }
    case "get_cart":
      return runAgentAction({
        action: "get_cart",
        arguments: input.arguments,
        decode: decodeEmptyActionInput,
        failureMessage: "Invalid get_cart arguments.",
        runApp: input.runApp,
      });
    case "add_cart_item":
      return runAgentAction({
        action: "add_cart_item",
        arguments: input.arguments,
        decode: decodeOrderItemInput,
        failureMessage: "Invalid add_cart_item arguments.",
        runApp: input.runApp,
      });
    case "update_cart_item":
      return runAgentAction({
        action: "update_cart_item",
        arguments: input.arguments,
        decode: decodeUpdateCartItemInput,
        failureMessage: "Invalid update_cart_item arguments.",
        runApp: input.runApp,
      });
    case "remove_cart_item":
      return runAgentAction({
        action: "remove_cart_item",
        arguments: input.arguments,
        decode: decodeCartItemIdInput,
        failureMessage: "Invalid remove_cart_item arguments.",
        runApp: input.runApp,
      });
    case "clear_cart":
      return runAgentAction({
        action: "clear_cart",
        arguments: input.arguments,
        decode: decodeEmptyActionInput,
        failureMessage: "Invalid clear_cart arguments.",
        runApp: input.runApp,
      });
    case "checkout_cart":
      return runAgentAction({
        action: "checkout_cart",
        arguments: input.arguments,
        decode: decodeCheckoutCartInput,
        failureMessage: "Invalid checkout_cart arguments.",
        runApp: input.runApp,
      });
    default:
      return Promise.reject(
        new UnsupportedAgentCapabilityError({
          capability: input.capability,
        }),
      );
  }
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
