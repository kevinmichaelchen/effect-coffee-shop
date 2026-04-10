import type { D1Database } from "@cloudflare/workers-types";
import type { AgentAuthOptions, AgentSession, Capability } from "@better-auth/agent-auth";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import {
  decodeListOrdersInput,
  decodeOrderIdInput,
  decodePlaceOrderInput,
} from "#presentation/assistant/tool-data";
import { formatToolFailure } from "#presentation/assistant/tool-format";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { CurrentActor } from "#service/CurrentActor";

const emptyObjectSchema = {
  properties: {},
  required: [],
  type: "object",
} as const;

const listOrdersSchema = {
  properties: {
    status: {
      description: "Optional order status filter such as pending, brewing, ready, or picked-up.",
      type: "string",
    },
  },
  required: [],
  type: "object",
} as const;

const orderIdSchema = {
  properties: {
    orderId: {
      description: "Coffee shop ticket id, such as order-0001.",
      type: "string",
    },
  },
  required: ["orderId"],
  type: "object",
} as const;

const placeOrderSchema = {
  properties: {
    drinkId: {
      description: "Menu drink id such as latte.",
      type: "string",
    },
    milk: {
      description: "Milk choice such as whole, oat, almond, or none.",
      type: "string",
    },
    notes: {
      description: "Optional order note.",
      type: "string",
    },
    shots: {
      description: "Number of espresso shots.",
      type: "integer",
    },
    size: {
      description: "Drink size such as small, medium, or large.",
      type: "string",
    },
    temperature: {
      description: "Drink temperature such as hot or iced.",
      type: "string",
    },
  },
  required: ["drinkId", "size"],
  type: "object",
} as const;

const coffeeAgentCapabilities = [
  {
    approvalStrength: "session",
    description: "List the current coffee menu for the signed-in customer.",
    input: emptyObjectSchema,
    name: "list_menu",
  },
  {
    approvalStrength: "session",
    description: "Create a new coffee order for the signed-in customer.",
    input: placeOrderSchema,
    name: "place_order",
  },
  {
    approvalStrength: "session",
    description: "Fetch one of the signed-in customer's orders by id.",
    input: orderIdSchema,
    name: "get_order",
  },
  {
    approvalStrength: "session",
    description: "List the signed-in customer's orders, optionally filtered by status.",
    input: listOrdersSchema,
    name: "list_orders",
  },
] as const satisfies ReadonlyArray<Capability>;

const toAgentActor = (session: AgentSession) => ({
  displayName: session.user.name.trim() || session.user.email,
  kind: "customer" as const,
  userId: session.user.id,
});

function makeAgentExecutionLayer(input: {
  readonly db: D1Database;
  readonly session: AgentSession;
}) {
  return Layer.mergeAll(
    Layer.succeed(CurrentActor)(toAgentActor(input.session)),
    CoffeeOrderApp.layer.pipe(Layer.provide(makeCloudflareCoffeeAppLive(input.db))),
  );
}

function toExecutionError(error: unknown): Error {
  return new Error(formatToolFailure(error));
}

async function decodeAgentInput<A>(input: {
  readonly decode: (value: unknown) => Promise<A>;
  readonly failureMessage: string;
  readonly value: unknown;
}) {
  return input.decode(input.value).catch(() => {
    throw new Error(input.failureMessage);
  });
}

async function runCoffeeEffect<A>(input: {
  readonly db: D1Database;
  readonly effect: Effect.Effect<A, unknown, CoffeeOrderApp>;
  readonly session: AgentSession;
}) {
  return Effect.runPromise(
    input.effect.pipe(
      Effect.mapError(toExecutionError),
      Effect.provide(makeAgentExecutionLayer({ db: input.db, session: input.session })),
    ),
  );
}

export async function executeCoffeeAgentCapability(input: {
  readonly arguments: Record<string, unknown> | undefined;
  readonly capability: string;
  readonly db: D1Database;
  readonly session: AgentSession;
}) {
  switch (input.capability) {
    case "list_menu":
      return runCoffeeEffect({
        db: input.db,
        effect: CoffeeOrderApp.use((app) => app.listMenu()),
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
        session: input.session,
      });
    }
    default:
      throw new Error(`Unsupported capability: ${input.capability}`);
  }
}

export function createCoffeeAgentAuthOptions(input: {
  readonly db: D1Database;
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
        session: agentSession,
      }),
    providerDescription:
      "Coffee ordering capabilities for delegated AI agents acting on behalf of a signed-in customer.",
    providerName: "Onion Coffee Shop",
  };
}
