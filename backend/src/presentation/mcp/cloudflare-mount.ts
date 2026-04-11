import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "#presentation/http/cloudflare-handler";
import { ensureCloudflareAuthPersistence } from "#presentation/auth/server";
import { systemActor } from "#service/CurrentActor";

const isMcpRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/mcp" || pathname.startsWith("/mcp/");
};

export const cloudflareMcpMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "mcp",
  matches: isMcpRequest,
  handle: async ({ env, request }) => {
    await ensureCloudflareAuthPersistence({
      db: env.DB,
      secret: env.BETTER_AUTH_SECRET,
    });

    return cloudflareResponse(
      await getCloudflareBackendHandler(env.DB)(
        request,
        createCloudflareRequestServices(systemActor),
      ),
    );
  },
};
