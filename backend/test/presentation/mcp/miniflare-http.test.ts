import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { describe, it } from "vitest";
import { makeMcpMiniflareClient } from "../../support/McpMiniflare.ts";

describe("mcp http on miniflare", () => {
  it("serves tools, resources, and prompts over MCP HTTP", async () => {
    const program = Effect.gen(function* () {
      const { request, responses } = yield* makeMcpMiniflareClient;

      const initialize = yield* request<{
        readonly protocolVersion: string;
        readonly serverInfo: {
          readonly name: string;
          readonly version: string;
        };
      }>("initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "vitest",
          version: "1.0.0",
        },
      });

      assert.strictEqual(initialize.protocolVersion, "2025-06-18");
      assert.strictEqual(initialize.serverInfo.name, "Coffee Orders MCP");

      const tools = yield* request<{
        readonly tools: ReadonlyArray<{ readonly name: string }>;
      }>("tools/list");
      const resources = yield* request<{
        readonly resources: ReadonlyArray<{ readonly uri: string }>;
      }>("resources/list");
      const prompts = yield* request<{
        readonly prompts: ReadonlyArray<{ readonly name: string }>;
      }>("prompts/list");

      const toolNames = tools.tools.map((tool) => tool.name).sort();
      const resourceUris = resources.resources.map((resource) => resource.uri).sort();
      const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();

      assert.deepStrictEqual(toolNames, [
        "cancel_order",
        "get_order",
        "list_menu",
        "list_orders",
        "mark_ready",
        "pick_up_order",
        "place_order",
        "start_brewing",
      ]);
      assert.deepStrictEqual(resourceUris, ["coffee://menu", "coffee://orders/open"]);
      assert.deepStrictEqual(promptNames, ["recommend-drink", "summarize-open-orders"]);

      const created = yield* request<{
        readonly isError?: boolean;
        readonly structuredContent: { readonly id: string };
      }>("tools/call", {
        name: "place_order",
        arguments: {
          customerName: "Avery",
          drinkId: "latte",
          size: "medium",
        },
      });

      assert.isFalse(created.isError === true);
      assert.strictEqual(created.structuredContent.id, "order-0001");

      const order = yield* request<{
        readonly contents: ReadonlyArray<{
          readonly uri?: string;
          readonly mimeType?: string;
          readonly text?: string;
        }>;
      }>("resources/read", {
        uri: "coffee://orders/order-0001",
      });
      const prompt = yield* request<{
        readonly messages: ReadonlyArray<{
          readonly content: {
            readonly type?: string;
            readonly text?: string;
          };
        }>;
      }>("prompts/get", {
        name: "recommend-drink",
        arguments: {
          occasion: "morning rush",
        },
      });
      const orderContent = order.contents[0];
      const promptContent = prompt.messages[0]?.content;

      assert.strictEqual(order.contents.length, 1);
      assert.strictEqual(orderContent?.uri, "coffee://orders/order-0001");
      assert.ok(orderContent !== undefined && "text" in orderContent);
      assert.include(String(orderContent.text), "order-0001");

      assert.strictEqual(prompt.messages.length, 1);
      assert.ok(promptContent !== undefined && "text" in promptContent);
      assert.strictEqual(prompt.messages[0]?.content.type, "text");
      assert.include(String(promptContent.text), "morning rush");

      assert.strictEqual(responses[0]?.headers.get("Mcp-Protocol-Version"), "2025-06-18");
    });

    await Effect.runPromise(Effect.scoped(program));
  });
});
