import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { afterAll, beforeAll } from "vitest";
import { createMcpMiniflareClient, type McpMiniflareClient } from "../support/McpMiniflare.ts";

/**
 * Test workflow where MCP tools place an order and we verify persistence
 */
const InitializeResponseSchema = Schema.Struct({
  protocolVersion: Schema.String,
});

const ToolCallOrderResultSchema = Schema.Struct({
  structuredContent: Schema.Struct({
    id: Schema.String,
  }),
});

const ToolCallConfirmationResultSchema = Schema.Struct({
  structuredContent: Schema.Struct({
    confirmationId: Schema.String,
  }),
});

const llmMcpWorkflow = () =>
  Effect.gen(function* () {
    const request = getClient().request;

    // Initialize MCP session
    yield* request(InitializeResponseSchema, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "llm-mcp-test",
        version: "1.0.0",
      },
    });

    const orderInput = {
      customerName: "Avery",
      items: [{ drinkId: "latte", size: "medium" }],
    };
    const confirmation = yield* request(ToolCallConfirmationResultSchema, "tools/call", {
      name: "prepare_order_confirmation",
      arguments: { items: orderInput.items },
    });
    const pending = yield* request(ToolCallConfirmationResultSchema, "tools/call", {
      name: "get_pending_confirmation",
      arguments: {},
    });

    // Place order after matching confirmation state exists
    const placeOrderResult = yield* request(ToolCallOrderResultSchema, "tools/call", {
      name: "place_order",
      arguments: { ...orderInput, confirmationId: pending.structuredContent.confirmationId },
    });

    const orderId = placeOrderResult.structuredContent.id;

    // Verify persistence by getting the order
    const getOrderResult = yield* request(ToolCallOrderResultSchema, "tools/call", {
      name: "get_order",
      arguments: { orderId },
    });

    return {
      success: true,
      orderId,
      pending,
      preparedConfirmation: confirmation,
      placeOrderResult,
      getOrderResult,
    };
  });

let client: McpMiniflareClient | undefined;

const getClient = () => {
  assert.ok(client !== undefined);

  return client;
};

describe("MCP tools with persistence verification", () => {
  beforeAll(async () => {
    client = await createMcpMiniflareClient();
  });

  afterAll(async () => {
    await getClient().dispose();
  });

  it.effect(
    "places order and verifies persistence",
    () =>
      Effect.gen(function* () {
        // Run workflow with timeout
        const result = yield* llmMcpWorkflow().pipe(Effect.timeout("60 seconds"));

        assert.ok(
          result.success,
          `Expected success but got success=${String(result.success)} orderId=${result.orderId}`,
        );
        assert.ok(result.orderId, `Expected order ID to be set`);
        assert.match(result.orderId, /^order-\d{4}$/);
        assert.strictEqual(result.getOrderResult.structuredContent.id, result.orderId);
      }),
    90000, // Vitest timeout
  );
});
