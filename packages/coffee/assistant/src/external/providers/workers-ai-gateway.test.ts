/**
 * Verifies Workers AI Gateway routing from the assistant HTTP handler.
 *
 * @module
 */
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { describe, expect, it } from "vitest";
import { handleAssistantRequest } from "../../presentation/http/handler.ts";
import {
  assistantModel,
  createAiRunMock,
  createAssistantRequest,
  createBindingAiConfig,
} from "../../test-support.ts";
import { createAssistantModelRunnerLayer } from "./index.ts";

const verifyAiGatewayRouting = async () => {
  const aiRun = createAiRunMock().mockResolvedValue({
    response: "Here is the menu.",
  });

  await handleAssistantRequest(
    createAssistantRequest([{ role: "user", content: "List the menu briefly." }]),
    {
      actor: systemActor,
      appLayer: InMemoryCoffeeAppLive,
      gatewayEnabled: true,
      model: assistantModel,
      modelLayer: createAssistantModelRunnerLayer(
        createBindingAiConfig(aiRun, "assistant-gateway"),
      ),
    },
  );

  expect(aiRun).toHaveBeenCalledWith(
    assistantModel,
    expect.anything(),
    expect.objectContaining({
      gateway: expect.objectContaining({
        collectLog: true,
        id: "assistant-gateway",
        metadata: expect.objectContaining({
          actor_kind: "system",
          route_kind: "assistant",
        }),
      }),
    }),
  );
};

describe("Workers AI Gateway assistant provider", () => {
  it(
    "routes Cloudflare Worker assistant traffic through the configured AI Gateway",
    verifyAiGatewayRouting,
  );
});
