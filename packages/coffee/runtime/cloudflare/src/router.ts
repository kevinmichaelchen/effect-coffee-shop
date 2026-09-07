/**
 * Routes Cloudflare Worker requests across auth, API, MCP, and assets routes.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { authRoute } from "./routes/auth.ts";
import type { CloudflareWorkerEnv } from "./env.ts";
import { assetsRoute } from "./routes/assets.ts";
import { createHttpRouter } from "@effect-coffee-shop/http-routing/router";
import { httpApiRoute } from "./routes/http-api.ts";
import { mcpRoute } from "./routes/mcp.ts";

const handleHttpRequest = createHttpRouter<CloudflareWorkerEnv>([
  authRoute,
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
