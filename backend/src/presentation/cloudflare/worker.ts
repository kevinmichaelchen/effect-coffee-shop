import type { ExecutionContext } from "@cloudflare/workers-types";
import { routeCloudflareRequest, type CloudflareWorkerEnv } from "#presentation/cloudflare/router";

export type { CloudflareWorkerEnv } from "#presentation/cloudflare/router";

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv, executionContext: ExecutionContext) {
    return routeCloudflareRequest(request, env, executionContext);
  },
};
