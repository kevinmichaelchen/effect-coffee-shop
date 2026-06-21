/**
 * Verifies Workers AI Gateway routing from the assistant HTTP handler.
 *
 * @module
 */
import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { jsonString } from "@effect-coffee-shop/http-routing/json";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { describe, expect, it, vi } from "vitest";
import { handleAssistantRequest } from "../../presentation/http/handler.ts";
import {
  createAssistantModelRunnerLayer,
  type AssistantAiConfig,
  type AssistantGatewayOptions,
} from "./index.ts";

const assistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";

const createAiRunMock = () =>
  vi.fn<
    (
      model: string,
      inputs: AiTextGenerationInput,
      options?: AssistantGatewayOptions,
    ) => Promise<AiTextGenerationOutput>
  >();

const createAssistantRequest = (messages: unknown) =>
  new Request("http://example.com/assistant", {
    body: jsonString({ messages }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

const createBindingAiConfig = (
  aiRun: ReturnType<typeof createAiRunMock>,
  gatewayId: string,
): AssistantAiConfig => ({
  kind: "workers-ai-binding",
  binding: {
    run: aiRun,
  },
  gatewayId,
  model: assistantModel,
});

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
