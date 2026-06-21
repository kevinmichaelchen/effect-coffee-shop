/**
 * Verifies Ollama-compatible assistant provider request handling.
 *
 * @module
 */
import { LLMock, type JournalEntry } from "@copilotkit/aimock";
import { jsonString } from "@effect-coffee-shop/http-routing/json";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";
import { CoffeeAppLive as InMemoryCoffeeAppLive } from "@effect-coffee-shop/coffee-external-in-memory";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it } from "vitest";
import { AssistantModelRunner } from "../../application/model.ts";
import { handleAssistantRequest } from "../../presentation/http/handler.ts";
import { makeOllamaRunner } from "./ollama-runtime.ts";

const localAssistantModel = "qwen3-beanline";

const createAssistantRequest = (messages: unknown) =>
  new Request("http://example.com/assistant", {
    body: jsonString({ messages }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

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

describe("Ollama assistant provider", () => {
  it("runs coffee tools through a local Ollama-compatible assistant provider", verifyOllamaToolRun);
});
