import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Test from "alchemy/Test/Vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { expect } from "vitest";
import Stack from "./cloudflare.ts";

const { afterAll, beforeAll, deploy, destroy, test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  state: Alchemy.localState(),
});

const deployed = beforeAll(deploy(Stack), { timeout: 300_000 });

afterAll(destroy(Stack), { timeout: 300_000 });

const HealthResponse = Schema.Struct({ status: Schema.Literal("ok") });
const McpInitializeResponse = Schema.Struct({
  id: Schema.String,
  jsonrpc: Schema.Literal("2.0"),
  result: Schema.Struct({
    protocolVersion: Schema.String,
    serverInfo: Schema.Struct({ name: Schema.String }),
  }),
});

test(
  "serves the Coffee API through Alchemy's local Cloudflare runtime",
  Effect.gen(function* () {
    const { url } = yield* deployed;
    const response = yield* HttpClient.get(new URL("/api/health", url));
    const health = yield* HttpClientResponse.schemaBodyJson(HealthResponse)(response);

    expect(health).toEqual({ status: "ok" });
  }),
);

test(
  "preserves string MCP JSON-RPC ids without a compatibility shim",
  Effect.gen(function* () {
    const { url } = yield* deployed;
    const request = yield* HttpClientRequest.post(new URL("/mcp", url)).pipe(
      HttpClientRequest.setHeader("accept", "application/json, text/event-stream"),
      HttpClientRequest.schemaBodyJson(
        Schema.Struct({
          id: Schema.String,
          jsonrpc: Schema.Literal("2.0"),
          method: Schema.Literal("initialize"),
          params: Schema.Struct({
            capabilities: Schema.Record(Schema.String, Schema.Unknown),
            clientInfo: Schema.Struct({ name: Schema.String, version: Schema.String }),
            protocolVersion: Schema.String,
          }),
        }),
      )({
        id: "alchemy-initialize",
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          capabilities: {},
          clientInfo: { name: "alchemy-integration", version: "1.0.0" },
          protocolVersion: "2025-06-18",
        },
      }),
    );
    const response = yield* HttpClient.execute(request);
    const initialize = yield* HttpClientResponse.schemaBodyJson(McpInitializeResponse)(response);

    expect(initialize.id).toBe("alchemy-initialize");
    expect(initialize.result.protocolVersion).toBe("2025-06-18");
    expect(initialize.result.serverInfo.name).toBe("Coffee Orders MCP");
  }),
);
