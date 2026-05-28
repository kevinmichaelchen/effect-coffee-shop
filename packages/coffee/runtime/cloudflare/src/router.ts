/**
 * Routes Cloudflare Worker requests across auth, assistant, API, MCP, and assets routes.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { assistantRoute } from "./routes/assistant.ts";
import { agentDiscoveryRoute, authRoute } from "./routes/auth.ts";
import type { CloudflareWorkerEnv } from "./env.ts";
import { assetsRoute } from "./routes/assets.ts";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { httpApiRoute } from "./routes/http-api.ts";
import { mcpRoute } from "./routes/mcp.ts";

const handleHttpRequest = createHttpRouter<CloudflareWorkerEnv>([
  agentDiscoveryRoute,
  authRoute,
  assistantRoute,
  httpApiRoute,
  mcpRoute,
  assetsRoute,
]);

export { type CloudflareWorkerEnv } from "./env.ts";

export const routeCloudflareRequest = (
  request: Request,
  env: CloudflareWorkerEnv,
  executionContext: ExecutionContext,
) =>
  handleHttpRequest(request, env, {
    waitUntil: (promise) => executionContext.waitUntil(promise),
  });
