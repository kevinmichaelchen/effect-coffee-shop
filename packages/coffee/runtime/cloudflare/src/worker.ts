/**
 * Exports the Cloudflare Worker fetch entrypoint.
 *
 * @module
 */
import type { ExecutionContext } from "@cloudflare/workers-types";
import { runHttpRequest } from "@effect-coffee-shop/http-routing/observability";
import { routeCloudflareRequest, type CloudflareWorkerEnv } from "./router.ts";

export type { CloudflareWorkerEnv } from "./router.ts";

export default {
  async fetch(
    request: Request,
    env: CloudflareWorkerEnv,
    executionContext: Pick<ExecutionContext, "waitUntil">,
  ) {
    return runHttpRequest(request, routeCloudflareRequest(request, env, executionContext));
  },
};
