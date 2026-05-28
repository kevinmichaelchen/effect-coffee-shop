/**
 * Exports the Cloudflare Worker fetch entrypoint.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { runHostEffect } from "@effect-coffee-shop/fetch-host/observability";
import { routeCloudflareRequest, type CloudflareWorkerEnv } from "./router.ts";

export type { CloudflareWorkerEnv } from "./router.ts";

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv, executionContext: ExecutionContext) {
    return runHostEffect(routeCloudflareRequest(request, env, executionContext));
  },
};
