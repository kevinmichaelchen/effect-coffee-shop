import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import { systemActor } from "@effect-coffee-shop/coffee-core/service/CurrentActor";
import { describe, expect, it, vi } from "vitest";
import { handleAssistantRequest } from "./handler.ts";
import type { AssistantAiConfig } from "./runtime.ts";
import type { AssistantGatewayOptions } from "./workers-ai-format.ts";

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
        kind: "binding",
        binding: {
          run: aiRun,
        },
      }
    : {
        kind: "binding",
        binding: {
          run: aiRun,
        },
        gatewayId,
      };

const createAssistantHandlerOptions = (aiRun: ReturnType<typeof createAiRunMock>) => ({
  actor: systemActor,
  ai: createBindingAiConfig(aiRun),
  appLayer: InMemoryCoffeeAppLive,
  model: assistantModel,
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

  expect(response.status).toBe(200);
  expect(aiRun).toHaveBeenCalledTimes(1);
  expect(aiRun).toHaveBeenCalledWith(
    assistantModel,
    expect.objectContaining({
      messages: expect.arrayContaining([
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
      ai: createBindingAiConfig(aiRun, "assistant-gateway"),
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

describe("assistant handler", () => {
  it("runs coffee tools before streaming the final assistant reply", verifyToolRun);
  it("accepts TanStack UI messages from the browser client", verifyUiMessages);
  it(
    "routes Cloudflare Worker assistant traffic through the configured AI Gateway",
    verifyAiGatewayRouting,
  );
});
