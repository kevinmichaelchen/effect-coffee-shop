import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Test from "alchemy/Test/Vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { expect } from "vitest";
import Stack from "./cloudflare.ts";

const { afterAll, beforeAll, deploy, destroy, test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  // Run the local providers in-process. Behind Alchemy's RPC sidecar the
  // Vite-hosted Worker deploys and serves fine, but `destroy(Stack)` never
  // returns, so the suite dies on the afterAll timeout.
  sidecar: false,
  state: Alchemy.localState(),
});

const deployed = beforeAll(deploy(Stack), { timeout: 300_000 });

afterAll(destroy(Stack), { timeout: 300_000 });

const HealthResponse = Schema.Struct({ status: Schema.Literal("ok") });

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
  "requires OAuth for remote MCP and advertises discovery",
  Effect.gen(function* () {
    const { url } = yield* deployed;
    const response = yield* HttpClient.execute(HttpClientRequest.post(new URL("/mcp", url)));
    expect(response.status).toBe(401);
    expect(response.headers["www-authenticate"]).toContain("oauth-protected-resource");
  }),
);

test(
  "returns 404 for the retired assistant and agent discovery endpoints",
  Effect.forEach(
    ["/api/assistant", "/api/auth/agent-configuration"],
    Effect.fnUntraced(function* (path) {
      const { url } = yield* deployed;
      const response = yield* HttpClient.get(new URL(path, url));
      expect(response.status).toBe(404);
    }),
    { concurrency: 1, discard: true },
  ),
);
