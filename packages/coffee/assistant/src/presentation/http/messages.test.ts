/**
 * Tests assistant request body parsing at the HTTP boundary.
 *
 * @module
 */
import { jsonString } from "@effect-coffee-shop/backend-host/json";
import { describe, expect, it } from "vitest";
import { parseAssistantRequestBody } from "./messages.ts";

const makeJsonRequest = (body: unknown): Request =>
  new Request("http://example.com/assistant", {
    body: jsonString(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

describe("assistant request body parsing", () => {
  it("accepts model-style assistant messages", async () => {
    const body = await parseAssistantRequestBody(
      makeJsonRequest({
        messages: [
          {
            content: "List the menu briefly.",
            role: "user",
          },
        ],
      }),
    );

    expect(body).toEqual({
      messages: [
        {
          content: "List the menu briefly.",
          role: "user",
        },
      ],
    });
  });

  it("accepts browser UI messages", async () => {
    const body = await parseAssistantRequestBody(
      makeJsonRequest({
        messages: [
          {
            id: "message-1",
            parts: [{ content: "List the menu briefly.", type: "text" }],
            role: "user",
          },
        ],
      }),
    );

    expect(body).toEqual({
      messages: [
        {
          id: "message-1",
          parts: [{ content: "List the menu briefly.", type: "text" }],
          role: "user",
        },
      ],
    });
  });

  it("returns null for invalid JSON", async () => {
    const body = await parseAssistantRequestBody(
      new Request("http://example.com/assistant", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    expect(body).toBeNull();
  });

  it("returns null for bodies outside the assistant request schema", async () => {
    const body = await parseAssistantRequestBody(
      makeJsonRequest({
        messages: [
          {
            content: "List the menu briefly.",
            role: "admin",
          },
        ],
      }),
    );

    expect(body).toBeNull();
  });
});
