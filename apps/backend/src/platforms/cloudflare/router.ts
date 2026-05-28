/**
 * Routes Cloudflare Worker requests across auth, assistant, API, MCP, and assets routes.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { cloudflareAssistantRoute } from "./routes/assistant.ts";
import { cloudflareAgentDiscoveryRoute, cloudflareAuthRoute } from "./routes/auth.ts";
import type { CloudflareWorkerEnv } from "./env.ts";
import { cloudflareAssetsRoute } from "./routes/assets.ts";
import { createFetchHost } from "@effect-coffee-shop/fetch-host/fetch-host";
import { cloudflareHttpApiRoute } from "./routes/http-api.ts";
import { cloudflareMcpRoute } from "./routes/mcp.ts";

const routeRequest = createFetchHost<CloudflareWorkerEnv>([
  cloudflareAgentDiscoveryRoute,
  cloudflareAuthRoute,
  cloudflareAssistantRoute,
  cloudflareHttpApiRoute,
  cloudflareMcpRoute,
  cloudflareAssetsRoute,
]);

export { type CloudflareWorkerEnv } from "./env.ts";

export const routeCloudflareRequest = (
  request: Request,
  env: CloudflareWorkerEnv,
  executionContext: ExecutionContext,
) =>
  routeRequest(request, env, {
    waitUntil: (promise) => executionContext.waitUntil(promise),
  });
