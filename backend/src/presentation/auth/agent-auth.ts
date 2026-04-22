import type { D1Database } from "@cloudflare/workers-types";
import type { AgentAuthOptions, AgentSession } from "@better-auth/agent-auth";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import {
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodePlaceOrderInput,
} from "#presentation/assistant/tool-data";
import { coffeeAgentCapabilities } from "#presentation/auth/agent-auth-data";
import { formatToolFailure } from "#presentation/assistant/tool-format";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CurrentActor } from "#service/CurrentActor";
import type { SendEmailBinding } from "#external/cloudflare/CloudflareEmailService";

const toAgentActor = (session: AgentSession) => ({
  displayName: session.user.name.trim() || session.user.email,
  email: session.user.email,
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

function makeAgentExecutionLayer(input: {
  readonly db: D1Database;
  readonly email: SendEmailBinding | undefined;
  readonly session: AgentSession;
}) {
  return Layer.mergeAll(
    Layer.succeed(CurrentActor)(toAgentActor(input.session)),
    CoffeeOrderApp.layer.pipe(Layer.provide(makeCloudflareCoffeeAppLive(input.db, input.email))),
  );
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
  readonly db: D1Database;
  readonly effect: Effect.Effect<A, unknown, CoffeeOrderApp>;
  readonly email: SendEmailBinding | undefined;
  readonly session: AgentSession;
}) {
  return Effect.runPromise(
    input.effect.pipe(
      Effect.mapError(toExecutionError),
      Effect.provide(
        makeAgentExecutionLayer({ db: input.db, email: input.email, session: input.session }),
      ),
    ),
  );
}

export async function executeCoffeeAgentCapability(input: {
  readonly arguments: unknown;
  readonly capability: string;
  readonly db: D1Database;
  readonly email: SendEmailBinding | undefined;
  readonly session: AgentSession;
}) {
  switch (input.capability) {
    case "list_menu":
      return runCoffeeEffect({
        db: input.db,
        effect: CoffeeOrderApp.use((app) => app.listMenu()),
        email: input.email,
        session: input.session,
      });
    case "place_order": {
      const payload = await decodeAgentInput({
        decode: decodePlaceOrderInput,
        failureMessage: "Invalid place_order arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        db: input.db,
        effect: CoffeeOrderApp.use((app) => app.placeOrder(payload)),
        email: input.email,
        session: input.session,
      });
    }
    case "get_order": {
      const payload = await decodeAgentInput({
        decode: decodeOrderIdInput,
        failureMessage: "Invalid get_order arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        db: input.db,
        effect: CoffeeOrderApp.use((app) => app.getOrder(payload.orderId)),
        email: input.email,
        session: input.session,
      });
    }
    case "list_orders": {
      const payload = await decodeAgentInput({
        decode: decodeListOrdersInput,
        failureMessage: "Invalid list_orders arguments.",
        value: input.arguments ?? {},
      });

      return runCoffeeEffect({
        db: input.db,
        effect: CoffeeOrderApp.use((app) => app.listOrders(payload)),
        email: input.email,
        session: input.session,
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
  readonly db: D1Database;
  readonly email: SendEmailBinding | undefined;
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
    onExecute: async ({ agentSession, arguments: args, capability }) =>
      executeCoffeeAgentCapability({
        arguments: args,
        capability,
        db: input.db,
        email: input.email,
        session: agentSession,
      }),
    providerDescription:
      "Coffee ordering capabilities for delegated AI agents acting on behalf of a signed-in customer.",
    providerName: "Effect Coffee Shop",
  };
}
