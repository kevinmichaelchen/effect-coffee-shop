/**
 * Shares assistant HTTP handler test setup.
 *
 * @module
 */
import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { jsonString } from "@effect-coffee-shop/http-routing/json";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { vi } from "vitest";
import {
  createAssistantModelRunnerLayer,
  type AssistantAiConfig,
  type AssistantGatewayOptions,
} from "./external/providers/index.ts";

export const assistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";

export const createAiRunMock = () =>
  vi.fn<
    (
      model: string,
      inputs: AiTextGenerationInput,
      options?: AssistantGatewayOptions,
    ) => Promise<AiTextGenerationOutput>
  >();

export const createAssistantRequest = (messages: unknown) =>
  new Request("http://example.com/assistant", {
    body: jsonString({ messages }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

export const createBindingAiConfig = (
  aiRun: ReturnType<typeof createAiRunMock>,
  gatewayId?: string,
): AssistantAiConfig => {
  const baseConfig = {
    kind: "workers-ai-binding" as const,
    binding: {
      run: aiRun,
    },
    model: assistantModel,
  };

  return gatewayId === undefined ? baseConfig : { ...baseConfig, gatewayId };
};

export const createAssistantHandlerOptions = (aiRun: ReturnType<typeof createAiRunMock>) => ({
  actor: systemActor,
  appLayer: InMemoryCoffeeAppLive,
  model: assistantModel,
  modelLayer: createAssistantModelRunnerLayer(createBindingAiConfig(aiRun)),
});
