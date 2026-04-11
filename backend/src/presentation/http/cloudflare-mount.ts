import { actorLogFields } from "#presentation/observability/logging";
import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import {
  createCloudflareRequestServices,
  getCloudflareBackendHandler,
} from "#presentation/http/cloudflare-handler";
import { ensureCloudflareAuthPersistence, resolveCloudflareActor } from "#presentation/auth/server";

const isApiRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api" || pathname.startsWith("/api/");
};

const rewriteApiRequest = (request: Request): Request => {
  const pathname = cloudflarePathname(request);
  const rewrittenPathname = pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return rewriteRequestPath(request, rewrittenPathname);
};

export const cloudflareHttpApiMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "api",
  matches: isApiRequest,
  handle: async ({ env, request }) => {
    await ensureCloudflareAuthPersistence({
      db: env.DB,
      secret: env.BETTER_AUTH_SECRET,
    });

    const actor = await resolveCloudflareActor({
      db: env.DB,
      request,
      secret: env.BETTER_AUTH_SECRET,
      staffUserIds: env.COFFEE_STAFF_USER_IDS,
    });

    return cloudflareResponse(
      await getCloudflareBackendHandler(env.DB)(
        rewriteApiRequest(request),
        createCloudflareRequestServices(actor),
      ),
      actorLogFields(actor),
    );
  },
};
