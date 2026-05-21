/**
 * Exports the Cloudflare Worker fetch entrypoint.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { routeCloudflareRequest, type CloudflareWorkerEnv } from "./router.ts";

export type { CloudflareWorkerEnv } from "./router.ts";

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv, executionContext: ExecutionContext) {
    return routeCloudflareRequest(request, env, executionContext);
  },
};
