import { getAssistantModel, handleAssistantRequest } from "#presentation/assistant/handler";
import type { AssistantAiConfig } from "#presentation/assistant/runtime";
import type { OnionCloudflareWorkerEnv } from "#presentation/cloudflare/context";
import {
  cloudflarePathname,
  cloudflareResponse,
  rewriteRequestPath,
  type CloudflareMount,
} from "#presentation/cloudflare/mount";
import { actorLogFields } from "#presentation/observability/logging";
import { ensureCloudflareAuthPersistence, resolveCloudflareActor } from "#presentation/auth/server";
import { makeCloudflareCoffeeAppLive } from "#runtime/cloudflare/live";

const isAssistantRequest = (request: Request): boolean => {
  const pathname = cloudflarePathname(request);
  return pathname === "/api/assistant" || pathname === "/api/assistant/";
};

const rewriteApiRequest = (request: Request): Request => {
  const pathname = cloudflarePathname(request);
  const rewrittenPathname = pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return rewriteRequestPath(request, rewrittenPathname);
};

const getAssistantAiConfig = (env: OnionCloudflareWorkerEnv): AssistantAiConfig | undefined => {
  const binding = env.AI;

  if (binding === undefined) {
    return undefined;
  }

  const gatewayId = env.AI_GATEWAY_ID?.trim();

  return gatewayId === undefined || gatewayId === ""
    ? { binding, kind: "binding" }
    : { binding, gatewayId, kind: "binding" };
};

export const cloudflareAssistantMount: CloudflareMount<OnionCloudflareWorkerEnv> = {
  name: "assistant",
  matches: isAssistantRequest,
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
      await handleAssistantRequest(rewriteApiRequest(request), {
        actor,
        ai: getAssistantAiConfig(env),
        appLayer: makeCloudflareCoffeeAppLive(env.DB),
        model: getAssistantModel(),
      }),
      actorLogFields(actor),
    );
  },
};
