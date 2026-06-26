/**
 * Tests the Miniflare-backed MCP worker surface.
 *
 * @module
 */
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  createMcpMiniflareClient,
  type McpMiniflareClient,
  type McpRequest,
} from "../../support/McpMiniflare.ts";

const StringIdResponseSchema = Schema.Struct({
  id: Schema.String,
});

const InitializeResponseSchema = Schema.Struct({
  protocolVersion: Schema.String,
  serverInfo: Schema.Struct({
    name: Schema.String,
    version: Schema.String,
  }),
});

const ToolListResponseSchema = Schema.Struct({
  tools: Schema.Array(
    Schema.Struct({
      name: Schema.String,
    }),
  ),
});

const ResourceListResponseSchema = Schema.Struct({
  resources: Schema.Array(
    Schema.Struct({
      uri: Schema.String,
    }),
  ),
});

const PromptListResponseSchema = Schema.Struct({
  prompts: Schema.Array(
    Schema.Struct({
      name: Schema.String,
    }),
  ),
});

const ToolCallOrderResponseSchema = Schema.Struct({
  isError: Schema.optionalKey(Schema.Boolean),
  structuredContent: Schema.Struct({
    id: Schema.String,
  }),
});

const ResourceReadResponseSchema = Schema.Struct({
  contents: Schema.Array(
    Schema.Struct({
      mimeType: Schema.optionalKey(Schema.String),
      text: Schema.optionalKey(Schema.String),
      uri: Schema.optionalKey(Schema.String),
    }),
  ),
});

const PromptGetResponseSchema = Schema.Struct({
  messages: Schema.Array(
    Schema.Struct({
      content: Schema.Struct({
        text: Schema.optionalKey(Schema.String),
        type: Schema.optionalKey(Schema.String),
      }),
    }),
  ),
});

const initializeClient = (request: McpRequest) =>
  request(InitializeResponseSchema, "initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "vitest",
      version: "1.0.0",
    },
  });

const placeLatteOrder = (request: McpRequest) =>
  request(ToolCallOrderResponseSchema, "tools/call", {
    name: "place_order",
    arguments: {
      customerName: "Avery",
      items: [{ drinkId: "latte", size: "medium" }],
    },
  });

const verifyCatalogSurface = (request: McpRequest) =>
  Effect.gen(function* () {
    const initialize = yield* initializeClient(request);
    const tools = yield* request(ToolListResponseSchema, "tools/list");
    const resources = yield* request(ResourceListResponseSchema, "resources/list");
    const prompts = yield* request(PromptListResponseSchema, "prompts/list");

    const toolNames = tools.tools.map((tool) => tool.name).sort();
    const resourceUris = resources.resources.map((resource) => resource.uri).sort();
    const promptNames = prompts.prompts.map((prompt) => prompt.name).sort();

    assert.strictEqual(initialize.protocolVersion, "2025-06-18");
    assert.strictEqual(initialize.serverInfo.name, "Coffee Orders MCP");
    assert.deepStrictEqual(toolNames, [
      "add_cart_item",
      "cancel_order",
      "checkout_cart",
      "clear_cart",
      "get_cart",
      "get_checkout_session",
      "get_item_options",
      "get_order",
      "list_menu",
      "list_orders",
      "mark_ready",
      "pick_up_order",
      "place_order",
      "prepare_cart_checkout",
      "quote_order",
      "remove_cart_item",
      "start_brewing",
      "update_cart_item",
      "validate_order",
    ]);
    assert.deepStrictEqual(resourceUris, ["coffee://menu", "coffee://orders/open"]);
    assert.deepStrictEqual(promptNames, ["recommend-drink", "summarize-open-orders"]);
  });

const verifyOrderResource = (request: McpRequest) =>
  Effect.gen(function* () {
    yield* initializeClient(request);
    const created = yield* placeLatteOrder(request);
    const orderId = created.structuredContent.id;
    const order = yield* request(ResourceReadResponseSchema, "resources/read", {
      uri: `coffee://orders/${orderId}`,
    });
    const orderContent = order.contents[0];

    assert.isFalse(created.isError === true);
    assert.match(orderId, /^order_[0123456789abcdefghjkmnpqrstvwxyz]{26}$/);
    assert.strictEqual(order.contents.length, 1);
    assert.strictEqual(orderContent?.uri, `coffee://orders/${orderId}`);
    assert.ok(orderContent?.text !== undefined);
    assert.include(String(orderContent.text), orderId);
  });

const verifyPromptAndProtocol = (request: McpRequest, responses: ReadonlyArray<Response>) =>
  Effect.gen(function* () {
    yield* initializeClient(request);
    const prompt = yield* request(PromptGetResponseSchema, "prompts/get", {
      name: "recommend-drink",
      arguments: {
        occasion: "morning rush",
      },
    });
    const promptContent = prompt.messages[0]?.content;

    assert.strictEqual(prompt.messages.length, 1);
    assert.ok(promptContent?.text !== undefined);
    assert.strictEqual(prompt.messages[0]?.content.type, "text");
    assert.include(String(promptContent.text), "morning rush");
    assert.strictEqual(responses[0]?.headers.get("Mcp-Protocol-Version"), "2025-06-18");
  });

const verifyStringRequestIds = (request: McpRequest, responses: ReadonlyArray<Response>) =>
  Effect.gen(function* () {
    const initialize = yield* request(
      InitializeResponseSchema,
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

    assert.ok(response !== undefined);

    const json = yield* Effect.promise(async () => response.json()).pipe(
      Effect.flatMap(Schema.decodeUnknownEffect(StringIdResponseSchema)),
    );

    assert.strictEqual(initialize.protocolVersion, "2025-06-18");
    assert.strictEqual(initialize.serverInfo.name, "Coffee Orders MCP");
    assert.strictEqual(json.id, "init");
  });

const runMcpTest = async (
  verify: (
    request: McpRequest,
    responses: ReadonlyArray<Response>,
  ) => Effect.Effect<unknown, unknown, never>,
) => Effect.runPromise(verify(getClient().request, getClient().responses));

let client: McpMiniflareClient | undefined;

const getClient = () => {
  assert.ok(client !== undefined);

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
