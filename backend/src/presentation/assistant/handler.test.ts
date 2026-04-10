import type { AiTextGenerationInput, AiTextGenerationOutput } from "@cloudflare/workers-types";
import { InMemoryCoffeeAppLive } from "#external/live";
import { describe, expect, it, vi } from "vitest";
import { handleAssistantRequest } from "./handler.ts";

const assistantModel = "@cf/meta/llama-3.1-8b-instruct-fast";

const createAiRunMock = () =>
  vi.fn<
    (
      model: string,
      inputs: AiTextGenerationInput,
      options?: Record<string, unknown>,
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

const createAssistantHandlerOptions = (aiRun: ReturnType<typeof createAiRunMock>) => ({
  ai: {
    binding: {
      run: aiRun,
    },
  },
  appLayer: InMemoryCoffeeAppLive,
  model: assistantModel,
});

describe("assistant handler", () => {
  it("runs coffee tools before streaming the final assistant reply", async () => {
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
      createAssistantRequest([
        {
          role: "user",
          content: "List the menu briefly.",
        },
      ]),
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
    expect(body).toContain("[DONE]");
  });

  it("accepts TanStack UI messages from the browser client", async () => {
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
    expect(body).toContain("[DONE]");
  });
});
