import { readCloudflareRuntime, revealOptionalSecret, type CloudflareWorkerEnv } from "../env.ts";
import {
  cloudflarePathname,
  cloudflareResponse,
  type CloudflareMount,
} from "@effect-coffee-shop/backend-host/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "../../composition/coffee-backend.ts";
import { ensureCloudflareAuthPersistence } from "@effect-coffee-shop/coffee-auth/better-auth/cloudflare";
import { systemActor } from "@effect-coffee-shop/coffee-core/application/CurrentActor";

const isMcpRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
};

export const cloudflareMcpMount: CloudflareMount<CloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ env, request }) => {
    const runtime = readCloudflareRuntime(env);

    await ensureCloudflareAuthPersistence({
      db: runtime.bindings.db,
      secret: revealOptionalSecret(runtime.config.betterAuthSecret),
    });

    return cloudflareResponse(
      await getCloudflareBackendHandler(runtime.bindings.db)(
        request,
        createCloudflareRequestServices(systemActor),
      ),
    );
  },
};
