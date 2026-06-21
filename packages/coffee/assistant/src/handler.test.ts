/**
 * Verifies assistant request handling, provider routing, and stream output.
 *
 * @module
 */
import { describe, expect, it } from "vitest";
import { handleAssistantRequest } from "./presentation/http/handler.ts";
import {
  createAiRunMock,
  createAssistantHandlerOptions,
  createAssistantRequest,
} from "./test-support.ts";

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

describe("assistant handler", () => {
  it("runs coffee tools before streaming the final assistant reply", verifyToolRun);
});
