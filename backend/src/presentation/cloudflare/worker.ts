import type { ExecutionContext } from "@cloudflare/workers-types";
import {
  routeCloudflareRequest,
  type OnionCloudflareWorkerEnv,
} from "#presentation/cloudflare/router";

export type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/router";

export default {
  async fetch(request: Request, env: OnionCloudflareWorkerEnv, executionContext: ExecutionContext) {
    return routeCloudflareRequest(request, env, executionContext);
  },
};
