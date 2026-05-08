import type { AgentAuthOptions, AgentSession } from "@better-auth/agent-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodePlaceOrderInput,
} from "@effect-coffee-shop/coffee-actions/assistant-tool-data";
import { emptyWebHandlerServices } from "@effect-coffee-shop/backend-host/request-services";
import { coffeeAgentCapabilities } from "@effect-coffee-shop/coffee-auth/agent-auth-data";
import { formatToolFailure } from "@effect-coffee-shop/coffee-actions/tool-format";
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

async function runCoffeeEffect<A>(input: {
  readonly effect: Effect.Effect<A, unknown, CoffeeOrderApp>;
  readonly runApp: CoffeeAppRunner;
}) {
  return input.runApp(input.effect.pipe(Effect.mapError(toExecutionError)));
}

export async function executeCoffeeAgentCapability(input: {
  readonly arguments: unknown;
  readonly capability: string;
  readonly runApp: CoffeeAppRunner;
}) {
  switch (input.capability) {
    case "list_menu":
      return runCoffeeEffect({
        effect: CoffeeOrderApp.use((app) => app.listMenu()),
        runApp: input.runApp,
      });
    case "place_order": {
      const payload = await decodeAgentInput({
        decode: decodePlaceOrderInput,
        failureMessage: "Invalid place_order arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        effect: CoffeeOrderApp.use((app) => app.placeOrder(payload)),
        runApp: input.runApp,
      });
    }
    case "get_order": {
      const payload = await decodeAgentInput({
        decode: decodeOrderIdInput,
        failureMessage: "Invalid get_order arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        effect: CoffeeOrderApp.use((app) => app.getOrder(payload.orderId)),
        runApp: input.runApp,
      });
    }
    case "list_orders": {
      const payload = await decodeAgentInput({
        decode: decodeListOrdersInput,
        failureMessage: "Invalid list_orders arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        effect: CoffeeOrderApp.use((app) => app.listOrders(payload)),
        runApp: input.runApp,
      });
    }
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
