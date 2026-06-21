/**
 * Verifies browser-originated assistant message normalization.
 *
 * @module
 */
import { jsonString } from "@effect-coffee-shop/http-routing/json";
import { describe, expect, it } from "vitest";
import { handleAssistantRequest } from "./presentation/http/handler.ts";
import {
  assistantModel,
  createAiRunMock,
  createAssistantHandlerOptions,
  createAssistantRequest,
} from "./test-support.ts";

const verifyBrowserMessages = async () => {
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

describe("assistant browser messages", () => {
  it("accepts TanStack UI messages from the browser client", verifyBrowserMessages);
});
