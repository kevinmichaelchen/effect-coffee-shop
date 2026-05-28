/**
 * Verifies assistant request handling, provider routing, and stream output.
 *
 * @module
 */
import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { LLMock, type JournalEntry } from "@copilotkit/aimock";
import { jsonString } from "@effect-coffee-shop/http-routing/json";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAssistantRequest } from "./presentation/http/handler.ts";
import { AssistantModelRunner } from "./application/model.ts";
import {
  createAssistantModelRunnerLayer,
  getAssistantAiConfigFromEnv,
  type AssistantAiConfig,
  type AssistantGatewayOptions,
} from "./external/providers/index.ts";
import { makeOllamaRunner } from "./external/providers/ollama-runtime.ts";

const assistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";
const localAssistantModel = "qwen3-beanline";

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
  gatewayId?: string,
): AssistantAiConfig =>
  gatewayId === undefined
    ? {
        kind: "workers-ai-binding",
        binding: {
          run: aiRun,
        },
        model: assistantModel,
      }
    : {
        kind: "workers-ai-binding",
        binding: {
          run: aiRun,
        },
        gatewayId,
        model: assistantModel,
      };

const createAssistantHandlerOptions = (aiRun: ReturnType<typeof createAiRunMock>) => ({
  actor: systemActor,
  appLayer: InMemoryCoffeeAppLive,
  model: assistantModel,
  modelLayer: createAssistantModelRunnerLayer(createBindingAiConfig(aiRun)),
});

const verifyToolRun = async () => {
  const aiRun = createAiRunMock()
    .mockResolvedValueOnce({
      tool_calls: [
        {
          id: "tool-1",
          arguments: {},
          name: "list_menu",
          type: "function",
          function: {
            arguments: "{}",
            name: "list_menu",
          },
        },
      ],
    })
    .mockResolvedValueOnce({
      response: "We have espresso drinks, cold brew, and tea available right now.",
    });

  const response = await handleAssistantRequest(
    createAssistantRequest([{ role: "user", content: "List the menu briefly." }]),
    createAssistantHandlerOptions(aiRun),
  );
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/event-stream");
  expect(aiRun).toHaveBeenCalledTimes(2);
  expect(body).toContain('"type":"CUSTOM"');
  expect(body).toContain('"name":"assistant_tool_activity"');
  expect(body).toContain('"label":"list_menu"');
  expect(body).toContain('"kind":"tool-call"');
  expect(body).toContain('"kind":"tool-result"');
  expect(body).toContain("espresso drinks, cold brew, and tea");
  expect(body).toContain('"type":"RUN_FINISHED"');
};

const verifyOllamaToolRun = async () => {
  const mock = new LLMock({ port: 0, strict: true });
  const requests: JournalEntry[] = [];

  mock.on(
    { hasToolResult: false, userMessage: "List the menu briefly." },
    {
      toolCalls: [
        {
          arguments: {},
          name: "list_menu",
        },
      ],
    },
  );
  mock.on(
    { hasToolResult: true, userMessage: "List the menu briefly." },
    {
      content: "We have espresso drinks, cold brew, and tea available right now.",
    },
  );

  const response = await handleAssistantRequest(
    createAssistantRequest([{ role: "user", content: "List the menu briefly." }]),
    {
      actor: systemActor,
      appLayer: InMemoryCoffeeAppLive,
      model: localAssistantModel,
      modelLayer: createAimockOllamaModelLayer(mock, requests),
    },
  );
  const body = await response.text();
  const requestBodies = jsonString(requests.map((request) => request.body));

  expect(response.status).toBe(200);
  expect(requests).toHaveLength(2);
  expect(requests.at(0)?.path).toBe("/api/chat");
  expect(requests.at(0)?.method).toBe("POST");
  expect(requestBodies).toContain(`"model":"${localAssistantModel}"`);
  expect(requestBodies).toContain('"tools"');
  expect(requestBodies).toContain('"role":"tool"');
  expect(requestBodies).toContain('"name":"list_menu"');
  expect(body).toContain('"label":"list_menu"');
  expect(body).toContain("espresso drinks, cold brew, and tea");
  expect(body).toContain('"type":"RUN_FINISHED"');
};

const createAimockOllamaModelLayer = (
  mock: LLMock,
  requests: JournalEntry[],
): Layer.Layer<AssistantModelRunner> =>
  Layer.effect(
    AssistantModelRunner,
    Effect.acquireRelease(
      Effect.promise(async () => {
        await mock.start();

        return makeOllamaRunner({
          endpoint: mock.url,
          kind: "ollama",
          model: localAssistantModel,
        });
      }),
      () =>
        Effect.gen(function* () {
          requests.push(...mock.getRequests());
          yield* Effect.promise(() => mock.stop());
        }),
    ),
  );

const verifyWorkersAiRestEnvWinsOverAmbientOllama = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
    COFFEE_ASSISTANT_MODEL: assistantModel,
    OLLAMA_HOST: "http://localhost:11434",
  });

  expect(config?.kind).toBe("workers-ai-rest");

  if (config?.kind !== "workers-ai-rest") {
    return;
  }

  expect(config.accountId).toBe("account-id");
  expect(Redacted.value(config.apiKey)).toBe("token");
  expect(config.model).toBe(assistantModel);
};

const verifyExplicitOllamaEnv = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
    COFFEE_ASSISTANT_MODEL: localAssistantModel,
    COFFEE_ASSISTANT_PROVIDER: "ollama",
  });

  expect(config).toEqual({
    endpoint: "http://localhost:11434",
    kind: "ollama",
    model: localAssistantModel,
  });
};

const verifyProviderRequiresModel = () => {
  const config = getAssistantAiConfigFromEnv({
    CLOUDFLARE_ACCOUNT_ID: "account-id",
    CLOUDFLARE_API_TOKEN: "token",
  });

  expect(config).toBeUndefined();
};

const verifyExplicitWorkersAiRequiresCredentials = () => {
  const config = getAssistantAiConfigFromEnv({
    COFFEE_ASSISTANT_MODEL: assistantModel,
    COFFEE_ASSISTANT_PROVIDER: "workers-ai",
    OLLAMA_HOST: "http://localhost:11434",
  });

  expect(config).toBeUndefined();
};

const verifyUiMessages = async () => {
  const aiRun = createAiRunMock().mockResolvedValue({
    response: "We have espresso drinks, cold brew, and tea available right now.",
  });

  const response = await handleAssistantRequest(
    createAssistantRequest([
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", content: "List the menu briefly." }],
      },
    ]),
    createAssistantHandlerOptions(aiRun),
  );
  const body = await response.text();
  const firstModelInputText = jsonString(aiRun.mock.calls[0]?.[1] ?? {});

  expect(response.status).toBe(200);
  expect(aiRun).toHaveBeenCalledTimes(1);
  expect(firstModelInputText.indexOf('"name":"place_order"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(firstModelInputText.indexOf('"name":"add_cart_item"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(firstModelInputText.indexOf('"name":"prepare_cart_checkout"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(firstModelInputText.indexOf('"name":"get_checkout_session"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(firstModelInputText.indexOf('"name":"checkout_cart"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(aiRun).toHaveBeenCalledWith(
    assistantModel,
    expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining(
            "read back the interpreted order and ask for confirmation before purchase",
          ),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("do not call place_order or checkout_cart yet"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("Should I place it?"),
        }),
        expect.objectContaining({
          role: "system",
          content: expect.stringContaining("520 cents becomes $5.20"),
        }),
        expect.objectContaining({
          role: "user",
          content: "List the menu briefly.",
        }),
      ]),
    }),
  );
  expect(body).toContain("espresso drinks, cold brew, and tea");
  expect(body).toContain('"type":"RUN_FINISHED"');
};

const verifyAiGatewayRouting = async () => {
  const aiRun = createAiRunMock().mockResolvedValue({
    response: "Here is the menu.",
  });

  await handleAssistantRequest(
    createAssistantRequest([{ role: "user", content: "List the menu briefly." }]),
    {
      ...createAssistantHandlerOptions(aiRun),
      gatewayEnabled: true,
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("assistant handler", () => {
  it("runs coffee tools before streaming the final assistant reply", verifyToolRun);
  it("runs coffee tools through a local Ollama-compatible assistant provider", verifyOllamaToolRun);
  it("requires the app composition root to choose an assistant model", verifyProviderRequiresModel);
  it(
    "prefers configured Workers AI credentials over an ambient Ollama host",
    verifyWorkersAiRestEnvWinsOverAmbientOllama,
  );
  it("uses Ollama only when explicitly selected without an endpoint", verifyExplicitOllamaEnv);
  it(
    "does not fall back to Ollama when Workers AI is explicitly selected without credentials",
    verifyExplicitWorkersAiRequiresCredentials,
  );
  it("accepts TanStack UI messages from the browser client", verifyUiMessages);
  it(
    "routes Cloudflare Worker assistant traffic through the configured AI Gateway",
    verifyAiGatewayRouting,
  );
});
