import {
  routeCloudflareRequest,
  type OnionCloudflareWorkerEnv,
} from "#presentation/cloudflare/router";

export type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/router";

export default {
  async fetch(request: Request, env: OnionCloudflareWorkerEnv) {
    return routeCloudflareRequest(request, env);
  },
};
