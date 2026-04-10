import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  createMcpMiniflareClient,
  type McpMiniflareClient,
  type McpRequest,
} from "../../../test/support/McpMiniflare.ts";

const StringIdResponseSchema = Schema.Struct({
  id: Schema.String,
});

const initializeClient = (request: McpRequest) =>
  request<{
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

const placeLatteOrder = (request: McpRequest) =>
  request<{
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

const verifyCatalogSurface = (request: McpRequest) =>
  Effect.gen(function* () {
    const initialize = yield* initializeClient(request);
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

    assert.strictEqual(initialize.protocolVersion, "2025-06-18");
    assert.strictEqual(initialize.serverInfo.name, "Coffee Orders MCP");
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
  });

const verifyOrderResource = (request: McpRequest) =>
  Effect.gen(function* () {
    yield* initializeClient(request);
    const created = yield* placeLatteOrder(request);
    const orderId = created.structuredContent.id;
    const order = yield* request<{
      readonly contents: ReadonlyArray<{
        readonly uri?: string;
        readonly mimeType?: string;
        readonly text?: string;
      }>;
    }>("resources/read", {
      uri: `coffee://orders/${orderId}`,
    });
    const orderContent = order.contents[0];

    assert.isFalse(created.isError === true);
    assert.match(orderId, /^order-\d{4}$/);
    assert.strictEqual(order.contents.length, 1);
    assert.strictEqual(orderContent?.uri, `coffee://orders/${orderId}`);
    assert.ok(orderContent !== undefined && "text" in orderContent);
    assert.include(String(orderContent.text), orderId);
  });

const verifyPromptAndProtocol = (request: McpRequest, responses: ReadonlyArray<Response>) =>
  Effect.gen(function* () {
    yield* initializeClient(request);
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
    const promptContent = prompt.messages[0]?.content;

    assert.strictEqual(prompt.messages.length, 1);
    assert.ok(promptContent !== undefined && "text" in promptContent);
    assert.strictEqual(prompt.messages[0]?.content.type, "text");
    assert.include(String(promptContent.text), "morning rush");
    assert.strictEqual(responses[0]?.headers.get("Mcp-Protocol-Version"), "2025-06-18");
  });

const verifyStringRequestIds = (request: McpRequest, responses: ReadonlyArray<Response>) =>
  Effect.gen(function* () {
    const initialize = yield* request<{
      readonly protocolVersion: string;
      readonly serverInfo: {
        readonly name: string;
      };
    }>(
      "initialize",
      {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "vitest",
          version: "1.0.0",
        },
      },
      {
        id: "init",
      },
    );
    const response = responses[0];
    const json =
      response === undefined
        ? null
        : Schema.decodeUnknownSync(StringIdResponseSchema)(
            yield* Effect.tryPromise({
              try: async () => response.json(),
              catch: (cause) => cause,
            }),
          );

    assert.strictEqual(initialize.protocolVersion, "2025-06-18");
    assert.strictEqual(initialize.serverInfo.name, "Coffee Orders MCP");
    assert.strictEqual(json?.id, "init");
  });

const runMcpTest = async (
  verify: (
    request: McpRequest,
    responses: ReadonlyArray<Response>,
  ) => Effect.Effect<unknown, unknown, never>,
) => Effect.runPromise(verify(getClient().request, getClient().responses));

let client: McpMiniflareClient | undefined;

const getClient = () => {
  if (client === undefined) {
    throw new Error("MCP Miniflare client is not initialized");
  }

  return client;
};

describe("mcp http on miniflare", () => {
  beforeAll(async () => {
    client = await createMcpMiniflareClient();
  });

  beforeEach(() => {
    getClient().resetSession();
  });

  afterAll(async () => {
    await getClient().dispose();
  });

  it("lists tools, resources, and prompts", async () => {
    await runMcpTest((request) => verifyCatalogSurface(request));
  });

  it("serves prompts and protocol headers", async () => {
    await runMcpTest((request, responses) => verifyPromptAndProtocol(request, responses));
  });

  it("serves placed orders through MCP resources", async () => {
    await runMcpTest((request) => verifyOrderResource(request));
  });

  it("preserves string JSON-RPC ids over MCP HTTP", async () => {
    await runMcpTest((request, responses) => verifyStringRequestIds(request, responses));
  });
});
