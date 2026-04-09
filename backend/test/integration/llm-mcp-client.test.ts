import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { afterAll, beforeAll } from "vitest";
import {
  createMcpMiniflareClient,
  type McpMiniflareClient,
} from "../support/McpMiniflare.ts";

/**
 * Test workflow where MCP tools place an order and we verify persistence
 */
const llmMcpWorkflow = () =>
  Effect.gen(function* () {
    const request = getClient().request;

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
      getOrderResult: getOrderResult as { structuredContent: { id: string } },
    };
  });

let client: McpMiniflareClient | undefined;

const getClient = () => {
  if (client === undefined) {
    throw new Error("MCP Miniflare client is not initialized");
  }

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

        assert.ok(result.success, `Expected success but got: ${JSON.stringify(result)}`);
        assert.ok(result.orderId, `Expected order ID to be set`);
        assert.match(result.orderId, /^order-\d{4}$/);
        assert.strictEqual(result.getOrderResult.structuredContent.id, result.orderId);
      }),
    90000, // Vitest timeout
  );
});
