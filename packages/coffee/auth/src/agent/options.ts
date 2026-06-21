import type { AgentAuthOptions } from "@better-auth/agent-auth";
import * as Effect from "effect/Effect";
import { coffeeAgentCapabilities } from "./capabilities.ts";
import { executeCoffeeAgentCapabilityEffect } from "./execution.ts";
import { createCoffeeAgentAppRunner, type CoffeeAgentAppLayer } from "./runner.ts";

export { executeCoffeeAgentCapabilityEffect } from "./execution.ts";
export { createCoffeeAgentAppRunner } from "./runner.ts";

export function createCoffeeAgentAuthOptions(input: {
  readonly appLayer: CoffeeAgentAppLayer;
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
