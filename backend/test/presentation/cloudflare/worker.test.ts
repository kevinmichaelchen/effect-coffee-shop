import type { D1Database } from "@cloudflare/workers-types";
import { Miniflare } from "miniflare";
import { describe, expect, it, vi } from "vitest";
import worker, {
  type OnionCloudflareWorkerEnv,
} from "../../../src/presentation/cloudflare/worker.ts";

const makeTestEnv = async (): Promise<{
  assetsFetch: ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;
  dispose: () => Promise<void>;
  env: OnionCloudflareWorkerEnv;
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
  it("rewrites /api requests into the existing HttpApi routes", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(new Request("http://example.com/api/health"), env);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: "ok" });
      expect(assetsFetch).not.toHaveBeenCalled();
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

  it("falls back to static assets for non-api routes", async () => {
    const { assetsFetch, dispose, env } = await makeTestEnv();

    try {
      const response = await worker.fetch(new Request("http://example.com/"), env);

      expect(response.status).toBe(200);
      expect(await response.text()).toContain("ui");
      expect(assetsFetch).toHaveBeenCalledTimes(1);
    } finally {
      await dispose();
    }
  });
});
