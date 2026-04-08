import path from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";

const MCP_WORKER_ENTRYPOINT = path.resolve(
  process.cwd(),
  "src/presentation/mcp/miniflare.worker.ts",
);

const bundleMcpWorker = Effect.tryPromise(async () => {
  const result = await build({
    bundle: true,
    entryPoints: [MCP_WORKER_ENTRYPOINT],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "esnext",
    write: false,
  });

  const output = result.outputFiles[0];
  if (output === undefined) {
    throw new Error("Miniflare worker bundle did not produce an output file");
  }

  return output.text;
});

const acquireMiniflare = Effect.gen(function* () {
  const workerScript = yield* bundleMcpWorker;

  return new Miniflare({
    compatibilityDate: "2026-03-31",
    modules: true,
    script: workerScript,
  });
});

const miniflareLayer = Effect.acquireRelease(acquireMiniflare, (miniflare) =>
  Effect.tryPromise(() => miniflare.dispose()),
);

export const makeMcpMiniflareClient = Effect.gen(function* () {
  const miniflare = yield* miniflareLayer;
  const baseUrl = new URL("/mcp", yield* Effect.tryPromise(() => miniflare.ready)).toString();
  const responses: Array<Response> = [];

  let sessionId: string | null = null;
  let requestId = 1;

  const request = <Result>(method: string, params?: unknown) =>
    Effect.tryPromise({
      try: async () => {
        const headers = new Headers({
          "content-type": "application/json",
        });

        if (sessionId !== null) {
          headers.set("Mcp-Session-Id", sessionId);
        }

        const response = await fetch(baseUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            id: requestId++,
            jsonrpc: "2.0",
            method,
            params,
          }),
        });

        sessionId = response.headers.get("Mcp-Session-Id") ?? sessionId;
        responses.push(response.clone());

        const json: Record<string, unknown> = await response.json();

        if ("error" in json) {
          throw new Error(JSON.stringify(json.error));
        }

        return json.result as Result;
      },
      catch: (cause) => cause,
    });

  return {
    baseUrl,
    request,
    responses,
  };
});
