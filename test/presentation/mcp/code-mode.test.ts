import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as McpServer from "effect/unstable/ai/McpServer";
import { InMemoryCoffeeAppLive } from "#external/live";
import { CoffeeCodeModeToolsLive } from "#presentation/mcp/code-mode";

const TestMcpClient = McpSchema.McpServerClient.of({
  clientId: 1,
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: {
      name: "vitest",
      version: "1.0.0",
    },
  },
  getClient: Effect.never,
});

const CodeModeTestLive = Layer.mergeAll(McpServer.McpServer.layer, CoffeeCodeModeToolsLive).pipe(
  Layer.provide(InMemoryCoffeeAppLive),
);

const callCode = (code: string) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server.callTool({
      name: "code",
      arguments: { code },
    });
  }).pipe(
    Effect.provideService(McpSchema.McpServerClient, TestMcpClient),
    Effect.provide(CodeModeTestLive),
  );

describe("mcp code mode", () => {
  it.effect("can orchestrate multiple coffee actions in one code execution", () =>
    Effect.gen(function* () {
      const response = yield* callCode(`
        async () => {
          const menu = await codemode.list_menu();
          const latte = menu.find((item) => item.id === "latte");
          const created = await codemode.place_order({
            customerName: "Avery",
            drinkId: latte.id,
            size: "medium",
          });
          const fetched = await codemode.get_order({ orderId: created.id });
          console.log("created", created.id);
          return { created, fetched };
        }
      `);

      assert.isFalse(response.isError === true);
      const content = response.structuredContent as {
        readonly result: {
          readonly created: { readonly id: string; readonly status: string };
          readonly fetched: { readonly id: string; readonly status: string };
        };
        readonly logs: ReadonlyArray<string>;
      };

      assert.strictEqual(content.result.created.id, "order-0001");
      assert.strictEqual(content.result.created.status, "pending");
      assert.strictEqual(content.result.fetched.id, "order-0001");
      assert.deepStrictEqual(content.logs, ["created order-0001"]);
    }),
  );

  it.effect("lets code catch domain errors from underlying actions", () =>
    Effect.gen(function* () {
      const response = yield* callCode(`
        async () => {
          try {
            await codemode.get_order({ orderId: "order-9999" });
            return { ok: false };
          } catch (error) {
            return error;
          }
        }
      `);

      assert.isFalse(response.isError === true);
      const content = response.structuredContent as {
        readonly result: { readonly _tag: string; readonly orderId: string };
        readonly logs: ReadonlyArray<string>;
      };

      assert.strictEqual(content.result._tag, "OrderNotFoundError");
      assert.strictEqual(content.result.orderId, "order-9999");
      assert.deepStrictEqual(content.logs, []);
    }),
  );

  it.effect("lets code catch argument validation errors from underlying actions", () =>
    Effect.gen(function* () {
      const response = yield* callCode(`
        async () => {
          try {
            await codemode.place_order({});
            return { ok: false };
          } catch (error) {
            return error;
          }
        }
      `);

      assert.isFalse(response.isError === true);
      const content = response.structuredContent as {
        readonly result: { readonly _tag: string; readonly message: string };
        readonly logs: ReadonlyArray<string>;
      };

      assert.strictEqual(content.result._tag, "CodeModeArgumentsError");
      assert.strictEqual(typeof content.result.message, "string");
      assert.deepStrictEqual(content.logs, []);
    }),
  );
});
