import type { ExecutionContext } from "@cloudflare/workers-types";
import { cloudflareAssistantMount } from "#presentation/assistant/cloudflare-mount";
import {
  cloudflareAgentDiscoveryMount,
  cloudflareAuthMount,
} from "#presentation/auth/cloudflare-mount";
import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import { cloudflareAssetsMount } from "#presentation/cloudflare/assets-mount";
import { createCloudflareHost } from "#presentation/cloudflare/host";
import { cloudflareHttpApiMount } from "#presentation/http/cloudflare-mount";
import { cloudflareMcpMount } from "#presentation/mcp/cloudflare-mount";

const routeRequest = createCloudflareHost<OnionCloudflareWorkerEnv>([
  cloudflareAgentDiscoveryMount,
  cloudflareAuthMount,
  cloudflareAssistantMount,
  cloudflareHttpApiMount,
  cloudflareMcpMount,
  cloudflareAssetsMount,
]);

export { type OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";

export const routeCloudflareRequest = async (
  request: Request,
  env: OnionCloudflareWorkerEnv,
  executionContext: ExecutionContext,
): Promise<Response> => routeRequest(request, env, executionContext);
