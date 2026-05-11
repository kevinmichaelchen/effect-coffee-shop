import { placeOrderActionJsonSchema } from "@effect-coffee-shop/coffee-actions/json-schema";
import { PlaceOrderTool } from "@effect-coffee-shop/coffee-actions/toolkit";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, it, vi } from "vitest";
import {
  AssistantModelRunner,
  type AssistantModelRunnerService,
  type AssistantToolDefinition,
} from "./model.ts";
import { runAssistantConversation } from "./runtime.ts";

const placedOrderResult = {
  createdAt: "2026-05-11T12:00:00Z",
  customerName: "Rowan",
  id: "order-0001",
  items: [
    {
      drinkId: "latte",
      drinkName: "Latte",
      lineTotalCents: 518,
      milk: "whole",
      quantity: 1,
      shots: 1,
      size: "medium",
      temperature: "hot",
      unitPriceCents: 518,
    },
  ],
  ownerUserId: "user-rowan",
  status: "pending",
  totalPriceCents: 518,
};

const placeOrderTool: AssistantToolDefinition = {
  execute: () => Effect.succeed(JSON.stringify(placedOrderResult)),
  parameters: placeOrderActionJsonSchema,
  tool: PlaceOrderTool,
};

describe("assistant runtime", () => {
  it("returns a deterministic receipt immediately after a purchase tool succeeds", async () => {
    const run = vi.fn<AssistantModelRunnerService["run"]>(() =>
      Effect.succeed({
        text: "",
        toolCalls: [
          {
            arguments: { confirmationId: "confirmation-0001", items: [] },
            id: "tool-1",
            name: "place_order",
          },
        ],
      }),
    );

    const result = await Effect.runPromise(
      runAssistantConversation({
        messages: [{ content: "Yes, place it.", role: "user" }],
        model: "test-model",
        systemPrompt: "Use tools.",
        tools: [placeOrderTool],
      }).pipe(Effect.provide(Layer.succeed(AssistantModelRunner)({ run }))),
    );

    expect(run).toHaveBeenCalledTimes(1);
    expect(result).toBe("medium hot whole milk Latte. Order order-0001. Total $5.18.");
  });
});
