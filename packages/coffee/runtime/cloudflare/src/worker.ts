/**
 * Exports the Cloudflare Worker fetch entrypoint.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { runHttpEffect } from "@effect-coffee-shop/http-routing/observability";
import { routeCloudflareRequest, type CloudflareWorkerEnv } from "./router.ts";

export type { CloudflareWorkerEnv } from "./router.ts";

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv, executionContext: ExecutionContext) {
    return runHttpEffect(routeCloudflareRequest(request, env, executionContext));
  },
};
