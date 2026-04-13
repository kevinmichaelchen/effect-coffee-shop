import alchemy from "alchemy";
import { Ai, AiGateway, D1Database, Website } from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";

import {
  collectorLogDestinationName,
  collectorTraceDestinationName,
} from "./ops/otel-collector-cloudflare/destination-names.ts";

// This physical app name is part of the deployed Alchemy/Cloudflare identity.
// Do not rename it casually; treat any change as a state migration.
const app = await alchemy("effect-v4-onion", {
  password: process.env.ALCHEMY_PASSWORD,
  stateStore: process.env.ALCHEMY_STATE_TOKEN
    ? (scope) => new CloudflareStateStore(scope)
    : undefined,
});
const aiGatewayEnabled = process.env.COFFEE_ASSISTANT_AI_GATEWAY === "1";
const otelExportEnabled = process.env.COFFEE_OTEL_EXPORT === "1";

export const coffeeDb = await D1Database("coffee-db", {
  dev: {
    remote: false,
  },
});

export const ai = Ai();

export const assistantGateway = aiGatewayEnabled
  ? await AiGateway("assistant", {
      authentication: true,
      collectLogs: true,
    })
  : undefined;

// This resource name is also stateful. Renaming it can recreate the website
// resource or fork deployment state.
export const website = await Website("onion", {
  url: true,
  compatibility: "node",
  entrypoint: "./backend/src/presentation/cloudflare/worker.ts",
  observability: {
    enabled: true,
    headSamplingRate: 1,
    logs: {
      destinations: otelExportEnabled ? [collectorLogDestinationName()] : [],
      enabled: true,
      headSamplingRate: 1,
      invocationLogs: true,
      persist: true,
    },
    traces: {
      destinations: otelExportEnabled ? [collectorTraceDestinationName()] : [],
      enabled: true,
      headSamplingRate: 1,
      persist: true,
    },
  },
  sourceMap: true,
  build: {
    command: "bun run --cwd ui build",
  },
  dev: {
    command: "bun run --cwd ui dev -- --host 127.0.0.1 --port 5173",
  },
  assets: {
    directory: "./ui/dist",
    run_worker_first: [
      "/.well-known/agent-configuration",
      "/api",
      "/api/*",
      "/mcp",
      "/mcp/*",
    ],
  },
  bindings: {
    AI: ai,
    AI_GATEWAY_ID: assistantGateway?.id ?? "",
    BETTER_AUTH_SECRET: alchemy.secret.env.BETTER_AUTH_SECRET,
    COFFEE_STAFF_USER_IDS: process.env.COFFEE_STAFF_USER_IDS ?? "",
    DB: coffeeDb,
  },
});

console.log({
  assistantGateway: assistantGateway?.id ?? null,
  database: coffeeDb.name,
  otelExportEnabled,
  url: website.url,
});

await app.finalize();
