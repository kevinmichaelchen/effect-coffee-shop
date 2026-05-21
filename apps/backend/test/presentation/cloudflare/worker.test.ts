import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { jsonString } from "@effect-coffee-shop/backend-host/json";
import { Miniflare } from "miniflare";
import { describe, expect, it, vi } from "vitest";
import worker, { type CloudflareWorkerEnv } from "../../../src/platforms/cloudflare/worker.ts";

const makeTestEnv = async (): Promise<{
  assetsFetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;
  dispose: () => Promise<void>;
  env: CloudflareWorkerEnv;
}> => {
  const miniflare = new Miniflare({
    d1Databases: {
      DB: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    },
    modules: true,
    script: "",
  });

  const db: D1Database = await miniflare.getD1Database("DB");
  const assetsFetch = vi.fn<(request: Request) => Promise<Response>>(
    async () =>
      new Response("<html>ui</html>", {
        headers: {
          "content-type": "text/html",
        },
        status: 200,
      }),
  );

  return {
    assetsFetch,
    dispose: () => miniflare.dispose(),
    env: {
      ASSETS: {
        fetch: assetsFetch,
      },
      DB: db,
    },
  };
};

type TestEnv = Awaited<ReturnType<typeof makeTestEnv>>;

const withTestEnv = async <A>(run: (env: TestEnv) => Promise<A>): Promise<A> => {
  const testEnv = await makeTestEnv();

  try {
    return await run(testEnv);
  } finally {
    await testEnv.dispose();
  }
};

const directHttpBearerError =
  "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.";

const expectDirectHttpBearerRejection = async (response: Response): Promise<void> => {
  expect(response.status).toBe(400);
  await expect(response.json()).resolves.toEqual({
    error: directHttpBearerError,
  });
};

const mcpInitializeRequest = (id: number | string): Request =>
  new Request("http://example.com/mcp", {
    body: jsonString({
      id,
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: {
          name: "vitest",
          version: "1.0.0",
        },
      },
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

describe("cloudflare worker", () => {
  const executionContext: ExecutionContext = {
    passThroughOnException() {},
    props: undefined,
    waitUntil() {},
  };

  const fetchWorker = (request: Request, env: CloudflareWorkerEnv): Promise<Response> =>
    worker.fetch(request, env, executionContext);

  it("rewrites /api requests into the existing HttpApi routes", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(new Request("http://example.com/api/health"), env);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(assetsFetch).not.toHaveBeenCalled();
    });
  });

  it("rejects bearer tokens on direct app API routes", async () => {
    await withTestEnv(async ({ env }) => {
      const response = await fetchWorker(
        new Request("http://example.com/api/me", {
          headers: {
            authorization: "Bearer agent-token",
          },
        }),
        env,
      );

      await expectDirectHttpBearerRejection(response);
    });
  });

  it("rejects bearer tokens on the assistant HTTP route", async () => {
    await withTestEnv(async ({ env }) => {
      const response = await fetchWorker(
        new Request("http://example.com/api/assistant", {
          body: jsonString({
            messages: [],
          }),
          headers: {
            authorization: "Bearer agent-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
        env,
      );

      await expectDirectHttpBearerRejection(response);
    });
  });

  it("serves the MCP HTTP surface without rewriting the path", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(mcpInitializeRequest(1), env);

      const json: {
        readonly result: {
          readonly protocolVersion: string;
          readonly serverInfo: {
            readonly name: string;
          };
        };
      } = await response.json();

      expect(response.status).toBe(200);
      expect(response.headers.get("Mcp-Protocol-Version")).toBe("2025-06-18");
      expect(json.result.protocolVersion).toBe("2025-06-18");
      expect(json.result.serverInfo.name).toBe("Coffee Orders MCP");
      expect(assetsFetch).not.toHaveBeenCalled();
    });
  });

  it("preserves string JSON-RPC ids on the MCP HTTP surface", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(mcpInitializeRequest("init"), env);

      const json: {
        readonly id: string;
        readonly result: {
          readonly protocolVersion: string;
        };
      } = await response.json();

      expect(response.status).toBe(200);
      expect(json.id).toBe("init");
      expect(json.result.protocolVersion).toBe("2025-06-18");
      expect(assetsFetch).not.toHaveBeenCalled();
    });
  });

  it("falls back to static assets for non-api routes", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(new Request("http://example.com/"), env);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ui");
      expect(assetsFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("returns unavailable for auth routes when the auth secret is absent", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(new Request("http://example.com/api/auth/session"), env);

      expect(response.status).toBe(503);
      expect(await response.text()).toBe(
        "Better Auth is unavailable. Configure BETTER_AUTH_SECRET.",
      );
      expect(assetsFetch).not.toHaveBeenCalled();
    });
  });

  it("exposes the agent discovery document from the well-known path", async () => {
    await withTestEnv(async ({ assetsFetch, env }) => {
      const response = await fetchWorker(
        new Request("http://example.com/.well-known/agent-configuration"),
        {
          ...env,
          BETTER_AUTH_SECRET: "test-secret-please-change-me-0001",
        },
      );

      const json: {
        readonly default_location: string;
        readonly endpoints: {
          readonly execute: string;
        };
        readonly provider_name: string;
      } = await response.json();

      expect(response.status).toBe(200);
      expect(json.provider_name).toBe("Effect Coffee Shop");
      expect(json.default_location).toBe("http://example.com/api/auth/capability/execute");
      expect(json.endpoints.execute).toBe("http://example.com/api/auth/capability/execute");
      expect(assetsFetch).not.toHaveBeenCalled();
    });
  });
});
