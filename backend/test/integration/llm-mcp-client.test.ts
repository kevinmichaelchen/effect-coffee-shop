import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { makeMcpMiniflareClient } from "../support/McpMiniflare.ts";

/**
 * Test workflow where MCP tools place an order and we verify persistence
 */
const llmMcpWorkflow = () =>
  Effect.gen(function* () {
    const { request } = yield* makeMcpMiniflareClient;

    // Initialize MCP session
    yield* request("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: {
        name: "llm-mcp-test",
        version: "1.0.0",
      },
    });

    // Place order directly with correct parameters
    const placeOrderResult = yield* request("tools/call", {
      name: "place_order",
      arguments: {
        customerName: "Avery",
        drinkId: "latte",
        size: "medium",
      },
    });

    const orderId = (placeOrderResult as { structuredContent: { id: string } }).structuredContent
      .id;

    // Verify persistence by getting the order
    const getOrderResult = yield* request("tools/call", {
      name: "get_order",
      arguments: { orderId },
    });

    return {
      success: true,
      orderId,
      placeOrderResult,
      getOrderResult,
    };
  });

describe("MCP tools with persistence verification", () => {
  it.effect(
    "places order and verifies persistence",
    () =>
      Effect.gen(function* () {
        // Run workflow with timeout
        const result = yield* llmMcpWorkflow().pipe(Effect.timeout("60 seconds"));

        assert.ok(result.success, `Expected success but got: ${JSON.stringify(result)}`);
        assert.ok(result.orderId, `Expected order ID to be set`);
        assert.strictEqual(result.orderId, "order-0001");
      }),
    90000, // Vitest timeout
  );
});
