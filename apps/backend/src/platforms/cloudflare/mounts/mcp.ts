import { readCloudflareRuntime, type CloudflareWorkerEnv } from "../env.ts";
import {
  cloudflarePathIsOrStartsWith,
  cloudflareResponse,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import { createCloudflareRequestServices, getCloudflareRuntimeBackend } from "../coffee-backend.ts";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const isMcpRequest = (request: Request): boolean => cloudflarePathIsOrStartsWith(request, "/mcp");

export const cloudflareMcpMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ env, request }) => {
    const runtime = readCloudflareRuntime(env);
    const backend = getCloudflareRuntimeBackend(runtime);

    await backend.ensureAuthPersistence();

    return cloudflareResponse(
      await backend.handler(request, createCloudflareRequestServices(systemActor)),
    );
  },
};
