import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createAssistantModelRunnerLayer, handleAssistantRequest } from "./handler.ts";
import type { AssistantAiConfig } from "./runtime.ts";
import type { AssistantGatewayOptions } from "./workers-ai-format.ts";

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
    body: JSON.stringify({ messages }),
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
      }
    : {
        kind: "workers-ai-binding",
        binding: {
          run: aiRun,
        },
        gatewayId,
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
  const fetchMock = vi
    .fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    .mockResolvedValueOnce(
      Response.json({
        message: {
          content: "",
          tool_calls: [
            {
              function: {
                arguments: {},
                name: "list_menu",
              },
            },
          ],
        },
      }),
    )
    .mockResolvedValueOnce(
      Response.json({
        message: {
          content: "We have espresso drinks, cold brew, and tea available right now.",
        },
      }),
    );

  vi.stubGlobal("fetch", fetchMock);

  const response = await handleAssistantRequest(
    createAssistantRequest([{ role: "user", content: "List the menu briefly." }]),
    {
      actor: systemActor,
      appLayer: InMemoryCoffeeAppLive,
      model: localAssistantModel,
      modelLayer: createAssistantModelRunnerLayer({
        kind: "ollama",
        endpoint: "http://localhost:11434/",
      }),
    },
  );
  const body = await response.text();
  const requestBodies = fetchMock.mock.calls.flatMap((call) => {
    const requestBody = call[1]?.body;

    return typeof requestBody === "string" ? [requestBody] : [];
  });

  expect(response.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock).toHaveBeenCalledWith(
    "http://localhost:11434/api/chat",
    expect.objectContaining({
      method: "POST",
    }),
  );
  expect(requestBodies.join("\n")).toContain(`"model":"${localAssistantModel}"`);
  expect(requestBodies.join("\n")).toContain('"tools"');
  expect(requestBodies.join("\n")).toContain('"tool_name":"list_menu"');
  expect(body).toContain('"label":"list_menu"');
  expect(body).toContain("espresso drinks, cold brew, and tea");
  expect(body).toContain('"type":"RUN_FINISHED"');
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
  const firstModelInputText = JSON.stringify(aiRun.mock.calls[0]?.[1] ?? {});

  expect(response.status).toBe(200);
  expect(aiRun).toHaveBeenCalledTimes(1);
  expect(firstModelInputText.indexOf('"name":"place_order"')).toBeLessThan(
    firstModelInputText.indexOf('"name":"list_menu"'),
  );
  expect(firstModelInputText.indexOf('"name":"add_cart_item"')).toBeLessThan(
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
  it("accepts TanStack UI messages from the browser client", verifyUiMessages);
  it(
    "routes Cloudflare Worker assistant traffic through the configured AI Gateway",
    verifyAiGatewayRouting,
  );
});
