import path from "node:path";
import { build } from "esbuild";
import { Miniflare } from "miniflare";
import * as Effect from "effect/Effect";

export type McpRequest = <Result>(method: string, params?: unknown) => Effect.Effect<Result, unknown>;

export type McpMiniflareClient = {
  readonly request: McpRequest;
  readonly responses: ReadonlyArray<Response>;
  readonly resetSession: () => void;
  readonly dispose: () => Promise<void>;
};

const MCP_WORKER_ENTRYPOINT = path.resolve(
  process.cwd(),
  "src/presentation/mcp/miniflare.worker.ts",
);

let bundledWorkerScriptPromise: Promise<string> | undefined;

const getBundledWorkerScript = () =>
  (bundledWorkerScriptPromise ??= build({
    bundle: true,
    entryPoints: [MCP_WORKER_ENTRYPOINT],
    format: "esm",
    logLevel: "silent",
    platform: "browser",
    target: "esnext",
    write: false,
  }).then((result) => {
    const output = result.outputFiles[0];
    if (output === undefined) {
      throw new Error("Miniflare worker bundle did not produce an output file");
    }

    return output.text;
  }));

export const createMcpMiniflareClient = async (): Promise<McpMiniflareClient> => {
  const script = await getBundledWorkerScript();
  const miniflare = new Miniflare({
    compatibilityDate: "2026-03-31",
    modules: true,
    script,
  });
  const baseUrl = new URL("/mcp", await miniflare.ready).toString();
  const responses: Array<Response> = [];

  let sessionId: string | null = null;
  let requestId = 1;

  const request: McpRequest = <Result>(method: string, params?: unknown) =>
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
    request,
    responses,
    resetSession: () => {
      sessionId = null;
      requestId = 1;
      responses.length = 0;
    },
    dispose: () => miniflare.dispose(),
  };
};
