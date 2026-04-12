import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { describe, expect, it, vi } from "vitest";
import worker, { type CloudflareWorkerEnv } from "../../../src/presentation/cloudflare/worker.ts";

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

describe("cloudflare worker", () => {
  const executionContext: ExecutionContext = {
    passThroughOnException() {},
    props: undefined,
    waitUntil() {},
  };

  it("rewrites /api requests into the existing HttpApi routes", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/api/health"),
        env,
        executionContext,
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(assetsFetch).not.toHaveBeenCalled();
    } finally {
      await dispose();
    }
  });

  it("rejects bearer tokens on direct app API routes", async () => {
    const { dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/api/me", {
          headers: {
            authorization: "Bearer agent-token",
          },
        }),
        env,
        executionContext,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error:
          "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
      });
    } finally {
      await dispose();
    }
  });

  it("rejects bearer tokens on the assistant HTTP route", async () => {
    const { dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/api/assistant", {
          body: JSON.stringify({
            messages: [],
          }),
          headers: {
            authorization: "Bearer agent-token",
            "content-type": "application/json",
          },
          method: "POST",
        }),
        env,
        executionContext,
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error:
          "Direct HTTP routes do not accept bearer agent tokens. Use session cookies for the app UI/API or MCP capability execution for agent access.",
      });
    } finally {
      await dispose();
    }
  });

  it("serves the MCP HTTP surface without rewriting the path", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/mcp", {
          body: JSON.stringify({
            id: 1,
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
        }),
        env,
        executionContext,
      );

      const json = (await response.json()) as {
        readonly result: {
          readonly protocolVersion: string;
          readonly serverInfo: {
            readonly name: string;
          };
        };
      };

      expect(response.status).toBe(200);
      expect(response.headers.get("Mcp-Protocol-Version")).toBe("2025-06-18");
      expect(json.result.protocolVersion).toBe("2025-06-18");
      expect(json.result.serverInfo.name).toBe("Coffee Orders MCP");
      expect(assetsFetch).not.toHaveBeenCalled();
    } finally {
      await dispose();
    }
  });

  it("preserves string JSON-RPC ids on the MCP HTTP surface", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/mcp", {
          body: JSON.stringify({
            id: "init",
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
        }),
        env,
        executionContext,
      );

      const json = (await response.json()) as {
        readonly id: string;
        readonly result: {
          readonly protocolVersion: string;
        };
      };

      expect(response.status).toBe(200);
      expect(json.id).toBe("init");
      expect(json.result.protocolVersion).toBe("2025-06-18");
      expect(assetsFetch).not.toHaveBeenCalled();
    } finally {
      await dispose();
    }
  });

  it("falls back to static assets for non-api routes", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/"),
        env,
        executionContext,
      );

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ui");
      expect(assetsFetch).toHaveBeenCalledTimes(1);
    } finally {
      await dispose();
    }
  });

  it("exposes the agent discovery document from the well-known path", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(
        new Request("http://example.com/.well-known/agent-configuration"),
        {
          ...env,
          BETTER_AUTH_SECRET: "test-secret-please-change-me-0001",
        },
        executionContext,
      );

      const json = (await response.json()) as {
        readonly default_location: string;
        readonly endpoints: {
          readonly execute: string;
        };
        readonly provider_name: string;
      };

      expect(response.status).toBe(200);
      expect(json.provider_name).toBe("Onion Coffee Shop");
      expect(json.default_location).toBe("http://example.com/api/auth/capability/execute");
      expect(json.endpoints.execute).toBe("http://example.com/api/auth/capability/execute");
      expect(assetsFetch).not.toHaveBeenCalled();
    } finally {
      await dispose();
    }
  });
});
