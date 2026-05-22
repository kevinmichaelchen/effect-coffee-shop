/**
 * Routes Cloudflare Worker requests across auth, assistant, API, MCP, and assets mounts.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { cloudflareAssistantMount } from "./mounts/assistant.ts";
import { cloudflareAgentDiscoveryMount, cloudflareAuthMount } from "./mounts/auth.ts";
import type { CloudflareWorkerEnv } from "./env.ts";
import { cloudflareAssetsMount } from "./mounts/assets.ts";
import { createFetchHost } from "@effect-coffee-shop/backend-host/fetch-host";
import { cloudflareHttpApiMount } from "./mounts/http-api.ts";
import { cloudflareMcpMount } from "./mounts/mcp.ts";

const routeRequest = createFetchHost<CloudflareWorkerEnv>([
  cloudflareAgentDiscoveryMount,
  cloudflareAuthMount,
  cloudflareAssistantMount,
  cloudflareHttpApiMount,
  cloudflareMcpMount,
  cloudflareAssetsMount,
]);

export { type CloudflareWorkerEnv } from "./env.ts";

export const routeCloudflareRequest = async (
  request: Request,
  env: CloudflareWorkerEnv,
  executionContext: ExecutionContext,
): Promise<Response> =>
  routeRequest(request, env, {
    waitUntil: (promise) => executionContext.waitUntil(promise),
  });
