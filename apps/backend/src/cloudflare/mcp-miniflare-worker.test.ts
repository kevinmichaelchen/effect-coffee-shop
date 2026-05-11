import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  createMcpMiniflareClient,
  type McpMiniflareClient,
  type McpRequest,
} from "../../test/support/McpMiniflare.ts";
import {
  InitializeResponseSchema,
  PromptGetResponseSchema,
  PromptListResponseSchema,
  ResourceListResponseSchema,
  ResourceReadResponseSchema,
  StringIdResponseSchema,
  ToolCallConfirmationResponseSchema,
  ToolCallOrderResponseSchema,
  ToolListResponseSchema,
} from "../../test/support/McpResponseSchemas.ts";

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
  Effect.gen(function* () {
    const orderInput = {
      customerName: "Avery",
      items: [{ drinkId: "latte", size: "medium" }],
    };
    const confirmation = yield* request(ToolCallConfirmationResponseSchema, "tools/call", {
      name: "prepare_order_confirmation",
      arguments: { items: orderInput.items },
    });
    const pending = yield* request(ToolCallConfirmationResponseSchema, "tools/call", {
      name: "get_pending_confirmation",
      arguments: {},
    });
    assert.strictEqual(
      pending.structuredContent.confirmationId,
      confirmation.structuredContent.confirmationId,
    );
    return yield* request(ToolCallOrderResponseSchema, "tools/call", {
      name: "place_order",
      arguments: { ...orderInput, confirmationId: pending.structuredContent.confirmationId },
    });
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
      "get_item_options",
      "get_order",
      "get_pending_confirmation",
      "list_menu",
      "list_orders",
      "mark_ready",
      "pick_up_order",
      "place_order",
      "prepare_cart_confirmation",
      "prepare_order_confirmation",
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
    assert.match(orderId, /^order-\d{4}$/);
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
